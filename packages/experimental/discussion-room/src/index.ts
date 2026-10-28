/** Bounded multi-model discussions over managed subagent activations. */

import { randomUUID } from 'node:crypto'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { z as zod } from 'zod'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-experimental-agent-team'
import type { SubagentActivation, SubagentResult } from '@deepseek-ai/dsh-subagent'
import type {} from '@deepseek-ai/dsh-session-persistence'
import { appendPluginRecord, SessionId } from '@deepseek-ai/dsh-session'
import type { ProjectionHandle } from '@deepseek-ai/dsh-session-projection'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { discussionRoomProjection } from './projection.ts'
import type { DiscussionRoomProjectionState } from './projection.ts'
import { moderatorPrompt, opinionPrompt, rebuttalPrompt } from './prompt.ts'
import type {
  CreateDiscussionRoomRequest,
  DiscussionMessage,
  DiscussionMessageId,
  DiscussionParticipant,
  DiscussionParticipantId,
  DiscussionRoom,
  DiscussionRoomId,
  DiscussionRoomProjection,
} from './types.ts'

export type * from './types.ts'

/** Discussion-room deployment limits. */
export interface Config {
  /** Registered local subagent provider used for every model contribution. */
  readonly provider?: string
  /** Maximum logical participants accepted in one room. */
  readonly maxParticipants?: number
  /** Maximum total rounds, including initial opinions and excluding moderation. */
  readonly maxRoundLimit?: number
  /** Maximum output tokens allowed for each model contribution. */
  readonly maxTokenLimit?: number
  /** Maximum UTF-8 bytes in one complete generated prompt. */
  readonly maxPromptBytes?: number
}

export const Config: z<Config> = z.object({
  /** Registered local subagent provider used for every model contribution. */
  provider: z.string().min(1).default('spawn'),
  /** Maximum logical participants accepted in one room. */
  maxParticipants: z.number().step(1).min(2).default(6),
  /** Maximum total rounds, including initial opinions and excluding moderation. */
  maxRoundLimit: z.number().step(1).min(1).default(5),
  /** Maximum output tokens allowed for each model contribution. */
  maxTokenLimit: z.number().step(1).min(1).default(32_768),
  /** Maximum UTF-8 bytes in one complete generated prompt. */
  maxPromptBytes: z.number().step(1).min(1).default(131_072),
})

declare module '@deepseek-ai/cordis' {
  interface Context {
    discussionRooms: DiscussionRoomService
  }
}

interface RoomRuntime {
  readonly controller: AbortController
  readonly activations: Set<SubagentActivation>
  operation: Promise<void>
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function outputText(result: SubagentResult): string {
  return result.output.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n').trim()
}

function stoppedRoom(room: DiscussionRoom): DiscussionRoom {
  return {
    ...room,
    status: 'stopped',
    messages: room.messages.map(message => message.status === 'running'
      ? { ...message, status: 'failed' as const, error: 'contribution stopped' }
      : message),
  }
}

/** Host-owned discussion orchestration, persistence, cancellation, and Remote face. */
export class DiscussionRoomService extends TypertRemoteService {
  static inject = ['agents', 'sessions', 'agentTeams', 'subagents', 'sessionProjections']
  static Config = Config
  private projection!: ProjectionHandle<DiscussionRoomProjectionState>
  private readonly rooms = new Map<SessionId, RoomRuntime>()
  private readonly config: Required<Config>
  private closing = false

  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'discussionRooms')
    this.config = {
      provider: config.provider ?? 'spawn',
      maxParticipants: config.maxParticipants ?? 6,
      maxRoundLimit: config.maxRoundLimit ?? 5,
      maxTokenLimit: config.maxTokenLimit ?? 32_768,
      maxPromptBytes: config.maxPromptBytes ?? 131_072,
    }
  }

  protected async [Service.init](): Promise<void> {
    this.projection = await this.ctx.sessionProjections.register(discussionRoomProjection)
    this.ctx.on('agent/disposed', ({ agent }) => { this.abort(agent.id) })
    this.ctx.on('agent/created', ({ agent }) => { this.recoverInterrupted(agent) })
    for (const agent of this.ctx.agents.list()) this.recoverInterrupted(agent)
    this.ctx.effect(() => async () => {
      this.closing = true
      for (const id of this.rooms.keys()) this.abort(id)
      const settled = await Promise.allSettled([...this.rooms.values()].map(runtime => runtime.operation))
      const failures: unknown[] = []
      for (const result of settled) {
        if (result.status === 'rejected') failures.push(result.reason)
      }
      if (failures.length > 0) throw new AggregateError(failures, 'Discussion-room disposal failed')
    }, 'discussionRooms: stop and drain rooms')
  }

  /**
   * Create and durably checkpoint one room, then run it in the background.
   * @param agent - exact live root Agent resolved from the addressed Session.
   * @param request - topic, routes, roles, and bounded rounds/output tokens.
   * @param signal - Remote cancellation before creation commits; it does not cancel an accepted room.
   * @returns the initial running room projection.
   */
  @Remote('create')
  async create(agent: Agent, request: CreateDiscussionRoomRequest, signal: AbortSignal): Promise<DiscussionRoomProjection> {
    this.assertLead(agent)
    signal.throwIfAborted()
    const input = this.requestSchema().parse(request)
    const prior = this.projection.stateOf(agent.session)
    if (prior.failure !== undefined) throw new Error(prior.failure)
    if (prior.room !== null) throw new Error('this Session already has a discussion room')
    const participants: DiscussionParticipant[] = input.participants.map((participant, index) => ({
      ...participant,
      id: brandString<DiscussionParticipantId>(`participant-${index + 1}`),
    }))
    const room: DiscussionRoom = {
      id: brandString<DiscussionRoomId>(agent.id),
      topic: input.topic,
      participants,
      moderator: { ...input.moderator, id: brandString<DiscussionParticipantId>('moderator') },
      roundLimit: input.roundLimit,
      tokenLimit: input.tokenLimit,
      currentRound: 0,
      status: 'running',
      messages: [],
    }
    await this.commit(agent, room)
    if (this.closing || this.ctx.agents.get(agent.id) !== agent) throw new Error('discussion-room service is unavailable')
    const controller = new AbortController()
    const runtime: RoomRuntime = {
      controller,
      activations: new Set(),
      operation: Promise.resolve(),
    }
    const operation = this.run(agent, controller.signal).catch((error: unknown) => {
      this.ctx.logger.warn(`Discussion room "${agent.id}" failed: ${messageOf(error)}`)
    }).finally(() => {
      if (this.rooms.get(agent.id) === runtime) this.rooms.delete(agent.id)
    })
    runtime.operation = operation
    this.rooms.set(agent.id, runtime)
    return this.projection.stateOf(agent.session)
  }

  /**
   * Stop the addressed running room without deleting its completed contributions.
   * @param agent - exact live root Agent resolved from the addressed Session.
   * @returns the stopping or already-terminal room projection.
   */
  @Remote('stop')
  async stop(agent: Agent): Promise<DiscussionRoomProjection> {
    this.assertLead(agent)
    const room = this.room(agent)
    if (room.status !== 'running') return { room }
    if (!this.rooms.has(agent.id)) {
      await this.commit(agent, stoppedRoom(room))
      return this.projection.stateOf(agent.session)
    }
    await this.commit(agent, { ...room, status: 'stopping' })
    this.abort(agent.id)
    return this.projection.stateOf(agent.session)
  }

  private requestSchema() {
    const text = (maximum: number) => zod.string().trim().min(1).max(maximum)
    const participant = zod.object({
      name: text(64), role: text(500), provider: text(200), model: text(200),
    }).strict()
    return zod.object({
      topic: text(8_000),
      participants: zod.array(participant).min(2).max(this.config.maxParticipants),
      moderator: zod.object({ name: text(64), provider: text(200), model: text(200) }).strict(),
      roundLimit: zod.number().int().min(1).max(this.config.maxRoundLimit),
      tokenLimit: zod.number().int().min(1).max(this.config.maxTokenLimit),
    }).strict().superRefine((request, context) => {
      const names = new Set<string>()
      for (const participant of request.participants) {
        const name = participant.name.toLocaleLowerCase()
        if (names.has(name)) context.addIssue({ code: 'custom', message: `duplicate participant name "${participant.name}"` })
        names.add(name)
      }
      if (names.has(request.moderator.name.toLocaleLowerCase())) {
        context.addIssue({ code: 'custom', message: 'moderator name must differ from participant names' })
      }
    })
  }

  private assertLead(agent: Agent): void {
    if (this.closing) throw new Error('discussion-room service is stopping')
    if (this.ctx.agentTeams.membership(agent).role !== 'lead') throw new Error('discussion rooms require a root Session')
  }

  private room(agent: Agent): DiscussionRoom {
    const projection = this.projection.stateOf(agent.session)
    if (projection.failure !== undefined) throw new Error(projection.failure)
    if (projection.room === null) throw new Error('this Session has no discussion room')
    return projection.room
  }

  private async commit(agent: Agent, room: DiscussionRoom): Promise<void> {
    appendPluginRecord(agent.session, 'plugin:discussion-room/state', { version: 1, room })
    await this.ctx.sessions.flush(agent.session)
  }

  private async update(agent: Agent, update: (room: DiscussionRoom) => DiscussionRoom): Promise<void> {
    const current = this.room(agent)
    if (current.status !== 'running') return
    await this.commit(agent, update(current))
  }

  private async run(agent: Agent, signal: AbortSignal): Promise<void> {
    try {
      const initial = this.room(agent)
      for (let round = 1; round <= initial.roundLimit; round += 1) {
        signal.throwIfAborted()
        await this.update(agent, room => ({ ...room, currentRound: round }))
        const participants = this.room(agent).participants
        await Promise.all(participants.map(async (participant) => {
          const promptRoom = this.room(agent)
          const prompt = round === 1 ? opinionPrompt(promptRoom, participant) : rebuttalPrompt(promptRoom, participant, round)
          await this.contribute(agent, participant, round, round === 1 ? 'opinion' : 'rebuttal', prompt, signal)
        }))
      }
      signal.throwIfAborted()
      const room = this.room(agent)
      const moderator: DiscussionParticipant = { ...room.moderator, role: 'moderator' }
      await this.contribute(agent, moderator, room.roundLimit, 'summary', moderatorPrompt(room), signal)
      const summary = this.room(agent).messages.find(message => message.kind === 'summary')
      if (summary?.status !== 'completed') throw new Error(summary?.error ?? 'moderator did not produce a final recommendation')
      await this.update(agent, current => ({ ...current, status: 'completed' }))
      signal.throwIfAborted()
    } catch (error: unknown) {
      const current = this.room(agent)
      if (current.status === 'stopping' || signal.aborted) {
        await this.commit(agent, stoppedRoom(current))
      } else {
        await this.commit(agent, { ...current, status: 'failed', failure: messageOf(error) })
      }
    }
  }

  private async contribute(
    agent: Agent,
    participant: DiscussionParticipant,
    round: number,
    kind: DiscussionMessage['kind'],
    prompt: string,
    signal: AbortSignal,
  ): Promise<void> {
    const message: DiscussionMessage = {
      id: brandString<DiscussionMessageId>(randomUUID()),
      participantId: participant.id,
      participantName: participant.name,
      role: participant.role,
      provider: participant.provider,
      model: participant.model,
      round,
      kind,
      status: 'running',
    }
    const append = (update: (current: DiscussionMessage) => DiscussionMessage) => this.update(agent, room => ({
      ...room,
      messages: room.messages.some(candidate => candidate.id === message.id)
        ? room.messages.map(candidate => candidate.id === message.id ? update(candidate) : candidate)
        : [...room.messages, update(message)],
    }))
    await append(current => current)
    let activation: Awaited<ReturnType<typeof this.ctx.subagents.startActivation>> | undefined
    try {
      if (Buffer.byteLength(prompt, 'utf8') > this.config.maxPromptBytes) {
        throw new Error(`discussion prompt exceeds ${this.config.maxPromptBytes} bytes`)
      }
      signal.throwIfAborted()
      activation = await this.ctx.subagents.startActivation({
        provider: this.config.provider,
        label: `Discussion: ${participant.name}, ${kind}`,
        delivery: 'caller',
        request: {
          parent: agent,
          prompt: [{ type: 'text', text: prompt }],
          agentOptions: {
            provider: participant.provider,
            model: participant.model,
            maxTokens: this.room(agent).tokenLimit,
          },
        },
        signal,
      })
      const runtime = this.rooms.get(agent.id)
      const childSessionId = activation.childId
      runtime?.activations.add(activation)
      if (signal.aborted) await activation.dispose()
      await append(current => ({ ...current, childSessionId }))
      const result = await activation.result
      const text = outputText(result)
      if (result.stopReason === 'completed' && text !== '') {
        await append(current => ({ ...current, status: 'completed', text }))
      } else {
        await append(current => ({
          ...current,
          status: 'failed',
          ...text === '' ? {} : { text },
          error: result.diagnostic ?? `model contribution ended with ${result.stopReason}`,
        }))
      }
    } catch (error: unknown) {
      await append(current => ({ ...current, status: 'failed', error: messageOf(error) }))
    } finally {
      if (activation !== undefined) {
        this.rooms.get(agent.id)?.activations.delete(activation)
        try {
          await activation.dispose()
        } catch (error: unknown) {
          await append(current => ({ ...current, status: 'failed', error: `contribution cleanup failed: ${messageOf(error)}` }))
        }
      }
    }
  }

  private abort(id: SessionId): void {
    const runtime = this.rooms.get(id)
    runtime?.controller.abort(new Error('discussion stopped'))
    for (const activation of runtime?.activations ?? []) {
      void activation.dispose().catch((error: unknown) => {
        this.ctx.logger.warn(`Discussion contribution "${activation.childId}" cleanup failed: ${messageOf(error)}`)
      })
    }
  }

  private recoverInterrupted(agent: Agent): void {
    const projection = this.projection.stateOf(agent.session)
    if (projection.room === null || (projection.room.status !== 'running' && projection.room.status !== 'stopping')
      || this.rooms.has(agent.id)) return
    void this.commit(agent, {
      ...projection.room,
      status: 'failed',
      failure: 'discussion was interrupted before completion',
      messages: projection.room.messages.map(message => message.status === 'running'
        ? { ...message, status: 'failed' as const, error: 'contribution was interrupted' }
        : message),
    }).catch((error: unknown) => {
      this.ctx.logger.warn(`Cannot record interrupted discussion "${agent.id}": ${messageOf(error)}`)
    })
  }
}

export default DiscussionRoomService
