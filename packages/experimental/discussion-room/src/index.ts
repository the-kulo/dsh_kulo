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
import { appendPluginRecord, SessionId, SessionLogOffset } from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import type { ProjectionHandle } from '@deepseek-ai/dsh-session-projection'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { discussionRoomProjection } from './projection.ts'
import type { DiscussionRoomProjectionState } from './projection.ts'
import { moderatorPrompt, opinionPrompt, rebuttalPrompt } from './prompt.ts'
import type {
  CreateDiscussionRoomRequest,
  DiscussionCatalogChild,
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
  /** Cadence in milliseconds for live contribution text checkpoints appended to the room while a contribution streams. */
  readonly liveUpdateIntervalMs?: number
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
  /** Cadence in milliseconds for live contribution text checkpoints appended to the room while a contribution streams. */
  liveUpdateIntervalMs: z.number().step(1).min(100).max(60_000).default(1_000),
})

declare module '@deepseek-ai/cordis' {
  interface Context {
    discussionRooms: DiscussionRoomService
  }
}

interface RoomRuntime {
  readonly agent: Agent
  readonly controller: AbortController
  readonly activations: Set<SubagentActivation>
  operation: Promise<void>
  /** Pending live contribution text awaiting a throttled room checkpoint. */
  readonly live: { readonly texts: Map<DiscussionMessageId, string>; timer: NodeJS.Timeout | undefined }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function outputText(result: SubagentResult): string {
  return result.output.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n').trim()
}

/**
 * Join the streamed text of one durable assistant stream (text deltas only),
 * matching the visible text the child streams so live room checkpoints agree
 * with the delta accumulation.
 * @param stream - the durable assistant stream records of a child message.
 * @returns the joined streamed text, empty when the stream carried no text delta.
 */
function joinedStreamText(stream: readonly {
  readonly type: string
  readonly texts?: readonly string[]
  readonly chunk?: { readonly type: string; readonly text?: string }
}[]): string {
  let text = ''
  for (const record of stream) {
    if (record.type === 'text-chunks' && record.texts !== undefined) {
      text += record.texts.join('')
    } else if (record.type === 'chunk' && record.chunk !== undefined
      && record.chunk.type === 'text-delta' && record.chunk.text !== undefined) {
      text += record.chunk.text
    }
  }
  return text
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

/**
 * The complete parent-catalog listing one commit's catalog record carries:
 * every contribution child the room established, in establishment order,
 * taken from the Session's own catalog facts, plus the children of any
 * inherited catalog record (a fork inherits the room checkpoints without the
 * matching own-suffix facts the catalog projection drops).
 * @param session - the room Session whose catalog supplies the listing.
 * @returns the ordered contribution children.
 */
function catalogChildren(session: Session): DiscussionCatalogChild[] {
  const children: DiscussionCatalogChild[] = []
  const seen = new Set<SessionId>()
  // oxlint-disable-next-line typescript/no-deprecated -- The room listing folds the Session's own catalog facts.
  for (const event of session.snapshotEvents(session.inheritedEventCount)) {
    if (event.type !== 'subagent/catalog') continue
    const { childId, childCreatedAt, mode, label } = event.data
    if (mode !== 'continuable' || label === undefined) continue
    if (seen.has(childId)) continue
    seen.add(childId)
    children.push({ childId, childCreatedAt, label })
  }
  // oxlint-disable-next-line typescript/no-deprecated -- Inherited records restore a fork's listing without facts.
  for (const event of session.snapshotEvents(SessionLogOffset(0), session.inheritedEventCount)) {
    if (event.type !== 'plugin:discussion-room/catalog' || event.data.version !== 1) continue
    for (const child of event.data.children) {
      if (seen.has(child.childId)) continue
      seen.add(child.childId)
      children.push(child)
    }
  }
  return children
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
      liveUpdateIntervalMs: config.liveUpdateIntervalMs ?? 1_000,
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
      agent,
      controller,
      activations: new Set(),
      operation: Promise.resolve(),
      live: { texts: new Map(), timer: undefined },
    }
    const operation = this.run(agent, controller.signal).catch((error: unknown) => {
      this.ctx.logger.warn(`Discussion room "${agent.id}" failed: ${messageOf(error)}`)
    }).finally(() => {
      if (runtime.live.timer !== undefined) clearTimeout(runtime.live.timer)
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
    appendPluginRecord(agent.session, 'plugin:discussion-room/catalog', { version: 1, children: catalogChildren(agent.session) })
    this.reemitCatalogFacts(agent.session)
    await this.ctx.sessions.flush(agent.session)
  }

  /**
   * Append own-suffix `subagent/catalog` facts for contribution children whose
   * facts are absent, so a fork that inherited the room checkpoints (but not
   * the matching facts the catalog projection drops) regains its listing.
   * Runs after both records committed, outside any append publication, so the
   * sequential appends never reenter another append.
   * @param session - the room Session whose own suffix receives the facts.
   */
  private reemitCatalogFacts(session: Session): void {
    const present = new Set<SessionId>()
    // oxlint-disable-next-line typescript/no-deprecated -- Replay decides against the durable own suffix.
    for (const candidate of session.snapshotEvents(session.inheritedEventCount)) {
      if (candidate.type === 'subagent/catalog') present.add(candidate.data.childId)
    }
    for (const child of catalogChildren(session)) {
      if (present.has(child.childId)) continue
      session.append('subagent/catalog', {
        version: 0,
        childId: child.childId,
        childCreatedAt: child.childCreatedAt,
        mode: 'continuable',
        label: child.label,
      })
    }
  }

  private async update(agent: Agent, update: (room: DiscussionRoom) => DiscussionRoom): Promise<void> {
    const current = this.room(agent)
    if (current.status !== 'running') return
    await this.commit(agent, update(current))
  }

  /**
   * Accumulate streamed text for one running contribution and schedule the
   * throttled room checkpoint that mirrors it into the message.
   * @param agent - the room's root Agent.
   * @param messageId - the running contribution message receiving the text.
   * @param delta - the next streamed text fragment.
   */
  private liveAppend(agent: Agent, messageId: DiscussionMessageId, delta: string): void {
    if (delta === '') return
    const runtime = this.rooms.get(agent.id)
    if (runtime === undefined) return
    runtime.live.texts.set(messageId, (runtime.live.texts.get(messageId) ?? '') + delta)
    this.scheduleLiveFlush(runtime)
  }

  /**
   * Mirror one committed child message's streamed text into the room message
   * immediately, replacing any pending delta accumulation.
   * @param agent - the room's root Agent.
   * @param messageId - the running contribution message receiving the text.
   * @param text - the committed streamed text.
   */
  private liveCommit(agent: Agent, messageId: DiscussionMessageId, text: string): void {
    const runtime = this.rooms.get(agent.id)
    if (runtime === undefined) return
    if (text === '') {
      // A committed message without streamed text supersedes any partial
      // pending accumulation; nothing to display.
      runtime.live.texts.delete(messageId)
      return
    }
    runtime.live.texts.set(messageId, text)
    this.flushLiveNow(agent)
  }

  /** Arm one pending room checkpoint per room; the timer coalesces parallel contributions. */
  private scheduleLiveFlush(runtime: RoomRuntime): void {
    if (runtime.live.timer !== undefined) return
    runtime.live.timer = setTimeout(() => {
      runtime.live.timer = undefined
      this.flushLive(runtime)
    }, this.config.liveUpdateIntervalMs)
  }

  /** Cancel the pending checkpoint and flush the room's accumulated live text now. */
  private flushLiveNow(agent: Agent): void {
    const runtime = this.rooms.get(agent.id)
    if (runtime === undefined) return
    if (runtime.live.timer !== undefined) {
      clearTimeout(runtime.live.timer)
      runtime.live.timer = undefined
    }
    this.flushLive(runtime)
  }

  /**
   * Append one non-flushing room checkpoint carrying every pending live text,
   * so the discussion tab shows the running contributions instead of their
   * content living only in the child subagent sessions. The terminal commit
   * later replaces the text with the canonical captured output.
   * @param runtime - the room whose pending texts are checkpointed.
   */
  private flushLive(runtime: RoomRuntime): void {
    const pending = runtime.live.texts
    if (pending.size === 0) return
    const texts = new Map(pending)
    pending.clear()
    const projection = this.projection.stateOf(runtime.agent.session)
    const current = projection.room
    if (projection.failure !== undefined || current === null || current.status !== 'running') return
    appendPluginRecord(runtime.agent.session, 'plugin:discussion-room/state', {
      version: 1,
      room: {
        ...current,
        messages: current.messages.map(candidate => {
          const text = texts.get(candidate.id)
          return text === undefined || text === '' ? candidate : { ...candidate, text }
        }),
      },
    })
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
    let disposeLive: (() => void) | undefined
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
      // Mirror the child's streamed assistant text into the running room
      // message, so the discussion tab shows the contribution live instead of
      // the logs living only in the child subagent session. Chunk frames are
      // coalesced into throttled room checkpoints; committed child messages
      // replace the pending text immediately.
      const child = signal.aborted ? undefined : this.ctx.agents.get(childSessionId)
      if (child !== undefined && runtime?.live !== undefined) {
        const live = runtime.live
        const disposeStream = child.ctx.on('agent/assistant-stream', ({ agent: subject, frame }) => {
          if (subject !== child) return
          if (frame.type === 'start') {
            live.texts.delete(message.id)
          } else if (frame.type === 'chunk') {
            if (frame.chunk.type === 'text-delta') this.liveAppend(agent, message.id, frame.chunk.text)
          } else if (frame.type === 'end') {
            this.flushLiveNow(agent)
          } else {
            // 'AssistantStreamFrame' is the closed union 'start' | 'chunk' | 'end'.
            throw new Error('unexpected assistant-stream frame')
          }
        })
        const disposeSession = child.ctx.on('session/event', (session, event) => {
          if (session !== child.session) return
          if (event.type === 'assistant/message' || event.type === 'assistant/attempt') {
            this.liveCommit(agent, message.id, joinedStreamText(event.data.stream))
          }
        })
        disposeLive = () => { disposeStream(); disposeSession() }
        // Catch up a contribution that committed before the listeners attached
        // (a fast model can finish its turn during activation startup): mirror
        // the last committed assistant text into the room immediately.
        // oxlint-disable-next-line typescript/no-deprecated -- Catch-up folds the child's existing committed suffix.
        for (const event of child.session.snapshotEvents()) {
          if (event.type === 'assistant/message' || event.type === 'assistant/attempt') {
            this.liveCommit(agent, message.id, joinedStreamText(event.data.stream))
          }
        }
      }
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
      disposeLive?.()
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
