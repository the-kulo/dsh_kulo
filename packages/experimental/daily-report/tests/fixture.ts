/** Real Loader composition with deterministic LLM and file-backed durable state. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
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
import ScheduleService from '@deepseek-ai/dsh-schedule'
import Storage from '@deepseek-ai/dsh-storage'
import * as SqliteStorage from '@deepseek-ai/dsh-storage-sqlite'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import DailyReportService from '../src/index.ts'

export function textResponse(text: string): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' }, { type: 'text-delta', index: 0, text },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'usage', usage: { inputTokens: 10, outputTokens: text.length } }, { type: 'finish', reason: { kind: 'stop' } },
  ]
}

export class FixtureAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []
  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const prompt = JSON.stringify(options.messages)
    const text = prompt.includes('Summarize the supplied work activity')
      ? prompt.includes('broken') ? 'not-json' : JSON.stringify({
        completed: ['Implemented the evidenced change'], inProgress: ['Review continues'], blocked: [], followUp: ['Verify the result'],
      })
      : 'Implemented the report parser'
    for (const chunk of textResponse(text)) yield chunk
  }
}

class FixtureWorkingDirectory extends Service {
  constructor(ctx: Context) { super(ctx, 'workingDirectory') }
  get(session: Session): string { return session.header.cwd ?? process.cwd() }
  async ensure(agent: Agent, signal?: AbortSignal): Promise<string> { signal?.throwIfAborted(); return this.get(agent.session) }
  async set(agent: Agent, path: string, signal?: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    return resolve(this.get(agent.session), path)
  }
}

function observation(source: 'live' | 'prepared', header: SessionHeader, events: readonly SessionEvent[]): SessionObservation {
  const lease = (): SessionObservation => ({
    source, header, inheritedEventCount: SessionLogOffset(0), events, cursor: events.at(-1)?.seq ?? -1,
    retain: lease, [Symbol.dispose]: () => {},
  })
  return lease()
}

class FixtureSessionQuery extends SessionQueryEngine {
  static override inject = ['sessions', 'sessionPersistence']
  override async observeSession(sessionId: SessionId, options: SessionObservationOptions = {}): Promise<SessionObservation> {
    const live = this.ctx.sessions.get(sessionId)
    if (live !== undefined) return observation('live', live.header, live.snapshotEvents())
    const handle = await this.ctx.sessionPersistence.open(sessionId, 'read', options.signal ? { signal: options.signal } : {})
    try {
      return observation('prepared', handle.header, (await handle.read(0, undefined, options.signal ? { signal: options.signal } : {})).events)
    } finally { await handle.close() }
  }
  override searchSessions(): Promise<never> { return Promise.reject(new Error('not configured')) }
  override searchEvents(): Promise<never> { return Promise.reject(new Error('not configured')) }
}

function storageDomain(ctx: Context): void {
  const facility = new DomainFacility(ctx, { backend: 'sqlite' })
  ctx.effect(() => {
    const unmount = ctx.storage.mount('domain', facility)
    ctx.provide('storageDomain', facility)
    return async () => { await facility.closeAll(); unmount() }
  })
}

export interface DailyReportFixture {
  readonly ctx: Context
  readonly adapter: FixtureAdapter
  readonly storageRoot: string
  dispose(): Promise<void>
}

export async function createDailyReportFixture(storageRoot?: string): Promise<DailyReportFixture> {
  const ownedRoot = storageRoot === undefined
  const root = storageRoot ?? await mkdtemp(join(tmpdir(), 'dsh-daily-report-'))
  const ctx = new Context()
  let disposed = false
  const dispose = async (): Promise<void> => {
    if (disposed) return
    disposed = true
    await ctx.fiber.dispose()
    if (ownedRoot) await rm(root, { recursive: true, force: true })
  }
  try {
    await mountAgentLoopTestDependencies(ctx)
    ctx.baseUrl = pathToFileURL(root).href + '/'
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['fixture:working-directory', FixtureWorkingDirectory], ['fixture:session-query', FixtureSessionQuery],
      ['fixture:storage-domain', { inject: ['storage'], apply: storageDomain }],
      ['@deepseek-ai/dsh-session-persistence-jsonl', JsonlSessionPersistence],
      ['@deepseek-ai/dsh-agent-loop', AgentLoop], ['@deepseek-ai/dsh-schedule', ScheduleService],
      ['@deepseek-ai/dsh-storage', Storage], ['@deepseek-ai/dsh-storage-sqlite', SqliteStorage],
      ['@deepseek-ai/dsh-experimental-daily-report', DailyReportService],
    ])
    const internal: ModuleLoaderV2 = {
      version: 'v2', loadCache: new Map(),
      import: async (specifier: string) => {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
      register(): never { throw new Error('unexpected module hook registration') },
      getOrCreateModuleJob(): never { throw new Error('unexpected module job creation') },
      resolveSync(): never { throw new Error('unexpected synchronous module resolution') },
      load(): never { throw new Error('unexpected module load') },
    }
    ctx.loader.internal = internal
    const profileEntries = composeEntries([
      loadOverlayPatches('dsh', fileURLToPath(new URL('../../daily-report-profile/cordis.patch.yml', import.meta.url))),
      [{ id: 'daily-report', config: { provider: 'mock', model: 'report-model' } }],
    ])
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, JSON.stringify([
      { name: 'fixture:working-directory' }, { name: 'fixture:session-query' },
      { name: '@deepseek-ai/dsh-storage' }, { name: '@deepseek-ai/dsh-storage-sqlite', config: { path: join(root, 'storage.sqlite') } },
      { name: 'fixture:storage-domain' }, { name: '@deepseek-ai/dsh-session-persistence-jsonl', config: { root } },
      { name: '@deepseek-ai/dsh-agent-loop', config: { agents: [] } }, { name: '@deepseek-ai/dsh-schedule' },
      ...profileEntries,
    ]))
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await ctx.loader.await()
    const adapter = new FixtureAdapter()
    ctx.llm.registerAdapter(['mock'], adapter)
    return { ctx, adapter, storageRoot: root, dispose }
  } catch (error) {
    await dispose()
    throw error
  }
}
