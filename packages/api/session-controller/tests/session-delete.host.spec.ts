import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { mountAgentLoopTestDependencies, mountAgentLoopTestHarness } from '@deepseek-ai/dsh-agent-loop-testkit'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { AgentHandle } from '@deepseek-ai/dsh-agent'
import * as JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSessionTestRemote, type TestSessionRemote } from './test-remote.ts'

const contexts: Context[] = []
const directories: string[] = []
const defaults = {
  defaultModelSelection: () => ({ provider: 'fixture', model: 'fixture-model' }),
  cwd: '/tmp',
}

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  await Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

async function harness() {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-session-delete-'))
  directories.push(directory)
  const ctx = new Context()
  contexts.push(ctx)
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(JsonlSessionPersistence, {
    root: join(directory, 'logs'), compression: 'none',
  })
  await mountAgentLoopTestHarness(ctx)
  const removeWorkspace = vi.fn(async () => {})
  ctx.provide('workspaceRegistry', {
    list: () => [],
    archivedSessionIds: [],
    pinnedSessionIds: [],
    removeSession: removeWorkspace,
  } as never)
  const remote = await createSessionTestRemote(ctx, { ...defaults, cwd: directory })
  const removeQuery = vi.spyOn(ctx.sessionQuery, 'removeSession')
  const persistenceDelete = vi.spyOn(ctx.sessionPersistence, 'delete')
  const removed = vi.fn()
  ctx.on('api-session/removed', removed)
  return { ctx, remote, removeWorkspace, removeQuery, persistenceDelete, removed }
}

async function create(remote: TestSessionRemote, id: string): Promise<SessionId> {
  const result = await remote.create({ sessionId: SessionId(id) })
  if (!result.ok) throw new Error(`fixture create failed: ${result.error.message}`)
  return result.value.sessionId
}

function ownedHandle(ctx: Context, sessionId: SessionId): AgentHandle {
  const controller = (ctx.sessionController as never as {
    agents: { ownedHandles: Map<SessionId, AgentHandle> }
  }).agents
  const handle = controller.ownedHandles.get(sessionId)
  if (handle === undefined) throw new Error('fixture Agent has no owned handle')
  return handle
}

describe('Session deletion', () => {
  it('disposes a live Agent before durable deletion and publishes removed last', async () => {
    const h = await harness()
    const sessionId = await create(h.remote, 'live-delete')
    const handle = ownedHandle(h.ctx, sessionId)
    const dispose = handle.dispose.bind(handle)
    const order: string[] = []
    vi.spyOn(handle, 'dispose').mockImplementation(async () => {
      await dispose()
      order.push('disposed')
    })
    h.persistenceDelete.mockImplementation(async () => { order.push('persistence') })
    h.removeQuery.mockImplementation(async () => { order.push('query') })
    h.removeWorkspace.mockImplementation(async () => { order.push('workspace') })
    h.removed.mockImplementation(() => { order.push('removed') })

    await expect(h.remote.delete({ sessionId })).resolves.toEqual({ ok: true, value: { removed: true } })

    expect(order).toEqual(['disposed', 'persistence', 'query', 'workspace', 'removed'])
    expect(h.removed).toHaveBeenCalledExactlyOnceWith(sessionId)
    await expect(h.ctx.sessionPersistence.stat(sessionId)).resolves.toBeUndefined()
    expect(h.ctx.agents.get(sessionId)).toBeUndefined()
    expect(h.ctx.sessions.get(sessionId)).toBeUndefined()
  })

  it('deletes a live Session after its writer has materialized', async () => {
    const h = await harness()
    const sessionId = await create(h.remote, 'materialized-live-delete')
    await h.ctx.sessionPersistence.flush()
    await expect(h.ctx.sessionPersistence.stat(sessionId)).resolves.toBeDefined()

    await expect(h.remote.delete({ sessionId })).resolves.toEqual({ ok: true, value: { removed: true } })

    await expect(h.ctx.sessionPersistence.stat(sessionId)).resolves.toBeUndefined()
    expect(h.ctx.agents.get(sessionId)).toBeUndefined()
    expect(h.ctx.sessions.get(sessionId)).toBeUndefined()
  })

  it('deletes a cold Session and keeps failure after live disposal unpublished', async () => {
    const h = await harness()
    const coldId = await create(h.remote, 'cold-delete')
    await h.ctx.sessionPersistence.flush()
    await ownedHandle(h.ctx, coldId).dispose()
    h.removed.mockClear()

    await expect(h.remote.delete({ sessionId: coldId })).resolves.toEqual({ ok: true, value: { removed: true } })
    expect(h.removed).toHaveBeenCalledExactlyOnceWith(coldId)
    await expect(h.ctx.sessionPersistence.stat(coldId)).resolves.toBeUndefined()

    const failedId = await create(h.remote, 'failed-delete')
    await h.ctx.sessionPersistence.flush()
    h.removed.mockClear()
    h.persistenceDelete.mockRejectedValueOnce(new Error('disk busy'))
    await expect(h.remote.delete({ sessionId: failedId })).resolves.toMatchObject({
      ok: false,
      error: { code: 'session/delete-failed' },
    })
    expect(h.removed).not.toHaveBeenCalled()
    expect(h.removeQuery).not.toHaveBeenCalledWith(failedId)
    expect(h.removeWorkspace).not.toHaveBeenCalledWith(failedId)
    await expect(h.ctx.sessionPersistence.stat(failedId)).resolves.toBeDefined()
  })

  it('refuses a live Agent owned elsewhere and an unknown Session', async () => {
    const h = await harness()
    const sessionId = SessionId('externally-owned')
    const session = h.ctx.sessions.create(sessionId)
    const agent = { id: sessionId, session, status: 'idle', ctx: h.ctx } as never
    await h.ctx.agents.register(agent)

    await expect(h.remote.delete({ sessionId })).resolves.toMatchObject({
      ok: false,
      error: { code: 'session/live-agent' },
    })
    expect(h.removed).not.toHaveBeenCalled()
    await expect(h.remote.delete({ sessionId: SessionId('missing') })).resolves.toMatchObject({
      ok: false,
      error: { code: 'session/not-found' },
    })
  })
})
