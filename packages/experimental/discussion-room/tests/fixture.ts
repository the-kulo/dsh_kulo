/** Real Loader composition with only the external LLM replaced by a deterministic adapter. */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { composeEntries, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { Context, Service } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader, { type ModuleLoaderV2 } from '@deepseek-ai/cordis-plugin-loader'
import type { Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { LlmAdapter, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionLogOffset, type Session, type SessionEvent, type SessionHeader, type SessionId } from '@deepseek-ai/dsh-session'
import * as JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SessionQueryEngine from '@deepseek-ai/dsh-session-query'
import type { SessionObservation, SessionObservationOptions } from '@deepseek-ai/dsh-session-query'
import SubagentService from '@deepseek-ai/dsh-subagent'
import * as SubagentSpawn from '@deepseek-ai/dsh-subagent-spawn-in-process'
import TeamService from '@deepseek-ai/dsh-experimental-agent-team'
import DiscussionRoomService from '../src/index.ts'
import type { Config } from '../src/index.ts'

export function textResponse(text: string): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'usage', usage: { inputTokens: 10, outputTokens: text.length } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

export class FixtureAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []

  constructor(private readonly respond: (options: GenerateOptions) => StreamChunk[] | 'hang') {
    super()
  }

  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const response = this.respond(options)
    if (response === 'hang') {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      await new Promise<void>((_resolve, reject) => {
        if (options.signal?.aborted) { reject(new Error('aborted')); return }
        options.signal?.addEventListener('abort', () => { reject(new Error('aborted')) }, { once: true })
      })
      return
    }
    for (const chunk of response) {
      options.signal?.throwIfAborted()
      yield chunk
    }
  }
}

class FixtureWorkingDirectory extends Service {
  private readonly directories = new WeakMap<Session, string>()

  constructor(ctx: Context) {
    super(ctx, 'workingDirectory')
  }

  get(session: Session): string {
    return this.directories.get(session) ?? session.header.cwd ?? process.cwd()
  }

  async ensure(agent: Agent, signal?: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    return this.get(agent.session)
  }

  async set(agent: Agent, path: string, signal?: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    const cwd = resolve(this.get(agent.session), path)
    this.directories.set(agent.session, cwd)
    return cwd
  }
}

function cut(source: 'live' | 'prepared', header: SessionHeader, events: readonly SessionEvent[]): SessionObservation {
  const lease = (): SessionObservation => ({
    source,
    header,
    inheritedEventCount: SessionLogOffset(0),
    events,
    cursor: events.at(-1)?.seq ?? -1,
    retain: lease,
    [Symbol.dispose]: () => {},
  })
  return lease()
}

class FixtureSessionQuery extends SessionQueryEngine {
  static override inject = ['sessions', 'sessionPersistence']

  override async observeSession(sessionId: SessionId, options: SessionObservationOptions = {}): Promise<SessionObservation> {
    const live = this.ctx.sessions.get(sessionId)
    if (live !== undefined) return cut('live', live.header, live.snapshotEvents())
    const handle = await this.ctx.sessionPersistence.open(sessionId, 'read', options.signal === undefined ? {} : { signal: options.signal })
    try {
      return cut('prepared', handle.header, (await handle.read(0, undefined, options.signal === undefined ? {} : { signal: options.signal })).events)
    } finally {
      await handle.close()
    }
  }

  override searchSessions(): Promise<never> {
    return Promise.reject(new Error('session search is not configured'))
  }

  override searchEvents(): Promise<never> {
    return Promise.reject(new Error('event search is not configured'))
  }
}

export interface DiscussionFixture {
  readonly ctx: Context
  readonly lead: Agent
  readonly adapter: FixtureAdapter
  readonly storageRoot: string
  dispose(): Promise<void>
}

export async function createDiscussionFixture(
  respond: (options: GenerateOptions) => StreamChunk[] | 'hang',
  config: Config = {},
): Promise<DiscussionFixture> {
  const storageRoot = await mkdtemp(join(tmpdir(), 'dsh-discussion-'))
  const ctx = new Context()
  let disposed = false
  const dispose = async (): Promise<void> => {
    if (disposed) return
    disposed = true
    await ctx.fiber.dispose()
    await rm(storageRoot, { recursive: true, force: true })
  }
  try {
    await mountAgentLoopTestDependencies(ctx)
    ctx.baseUrl = pathToFileURL(storageRoot).href + '/'
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['fixture:working-directory', FixtureWorkingDirectory],
      ['fixture:session-query', FixtureSessionQuery],
      ['@deepseek-ai/dsh-session-persistence-jsonl', JsonlSessionPersistence],
      ['@deepseek-ai/dsh-agent-loop', AgentLoop],
      ['@deepseek-ai/dsh-subagent', SubagentService],
      ['@deepseek-ai/dsh-subagent-spawn-in-process', SubagentSpawn],
      ['@deepseek-ai/dsh-experimental-agent-team', TeamService],
      ['@deepseek-ai/dsh-experimental-discussion-room', DiscussionRoomService],
    ])
    const internal: ModuleLoaderV2 = {
      version: 'v2',
      loadCache: new Map(),
      import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return Promise.resolve(modules.get(specifier))
      },
      register(): never { throw new Error('unexpected module hook registration') },
      getOrCreateModuleJob(): never { throw new Error('unexpected module job creation') },
      resolveSync(): never { throw new Error('unexpected synchronous module resolution') },
      load(): never { throw new Error('unexpected module load') },
    }
    ctx.loader.internal = internal
    const profileEntries = composeEntries([
      loadOverlayPatches('dsh', fileURLToPath(new URL('../../discussion-room-profile/cordis.patch.yml', import.meta.url))),
      [{ id: 'discussion-room', config }],
    ]).filter(entry => entry.id !== 'ui-discussion-room')
    const configPath = join(storageRoot, 'cordis.yml')
    await writeFile(configPath, JSON.stringify([
      { name: 'fixture:working-directory' },
      { name: 'fixture:session-query' },
      { name: '@deepseek-ai/dsh-session-persistence-jsonl', config: { root: storageRoot } },
      { name: '@deepseek-ai/dsh-agent-loop', config: { agents: [] } },
      { name: '@deepseek-ai/dsh-subagent' },
      { name: '@deepseek-ai/dsh-subagent-spawn-in-process', config: { providerName: 'spawn' } },
      ...profileEntries,
    ]))
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await ctx.loader.await()
    const adapter = new FixtureAdapter(respond)
    ctx.llm.registerAdapter(['mock'], adapter)
    const lead = await ctx.agentLoop.create('discussion-root' as SessionId, { provider: 'mock', model: 'root-model' })
    return { ctx, lead, adapter, storageRoot, dispose }
  } catch (error) {
    await dispose()
    throw error
  }
}

export async function storedEvents(ctx: Context, id: SessionId): Promise<readonly SessionEvent[]> {
  const handle = await ctx.sessionPersistence.open(id, 'read')
  try {
    return (await handle.read()).events
  } finally {
    await handle.close()
  }
}
