/** Auto-commit consumer: turn-end events schedule one debounced commit per workspace. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import { SessionId, SessionSeq } from '@deepseek-ai/dsh-session'
import type { Workspace, WorkspaceGitBinding, WorkspaceRegistry } from '@deepseek-ai/dsh-workspace'
import { installAutoCommit } from '../src/autocommit.ts'
import { GitService } from '../src/service.ts'
import type {
  GitCommit,
  GitCommitRequest,
  GitCommitResult,
  GitRepository,
  GitStatus,
} from '../src/types.ts'

// Mock realpath to resolve immediately, avoiding real IO interaction with fake timers.
vi.mock('node:fs/promises', () => ({
  realpath: (path: string) => Promise.resolve(path),
}))

const cwd = process.cwd()

/** A status view with the given working-tree changes. */
function makeStatus(changes: readonly GitStatus['changes']): GitStatus {
  return {
    repository: { root: cwd, gitDir: `${cwd}/.git`, branch: 'main', remote: 'git@github.com:org/repo.git' },
    clean: changes.length === 0,
    ahead: 0,
    behind: 0,
    changes,
  }
}

/** Git service double that records commits and returns a scripted status. */
class StubGitService extends GitService {
  // Public: the Cordis service proxy forwards public fields but not `#private` ones.
  readonly statusResult: GitStatus | undefined
  readonly commits: GitCommitRequest[] = []

  constructor(ctx: Context, statusResult: GitStatus | undefined) {
    super(ctx)
    this.statusResult = statusResult
  }

  async discover(): Promise<GitRepository | undefined> {
    return undefined
  }

  async bind(): Promise<GitRepository> {
    throw new Error('bind is not stubbed')
  }

  async status(): Promise<GitStatus | undefined> {
    return this.statusResult
  }

  async commit(request: GitCommitRequest): Promise<GitCommitResult> {
    this.commits.push(request)
    const commit: GitCommit = {
      oid: 'f0e1d2c3b4a5968778695a4b3c2d1e0f19283746',
      shortOid: 'f0e1d2c',
      message: request.message,
      author: 'DeepSeek Harness',
      timestamp: '2026-01-01T00:00:00.000Z',
    }
    return { committed: true, commit }
  }

  async log(): Promise<readonly GitCommit[]> {
    return []
  }

  async listBranches(): Promise<readonly string[]> {
    return []
  }

  async checkout(): Promise<GitRepository> {
    throw new Error('checkout is not stubbed')
  }

  async promote(): Promise<GitRepository> {
    throw new Error('promote is not stubbed')
  }
}

function makeBinding(autoCommit: boolean): WorkspaceGitBinding {
  return {
    remote: 'git@github.com:org/repo.git',
    branches: ['main'],
    activeBranch: 'main',
    autoCommit,
    boundAt: '2026-01-01T00:00:00.000Z',
  }
}

function makeWorkspace(git: WorkspaceGitBinding | undefined): Workspace {
  const path: string = cwd
  return { path, git } as Workspace
}

function makeSession(): Session {
  const header: SessionHeader = {
    version: 4,
    id: SessionId('session-1'),
    createdAt: 0,
    isSeeded: false,
    cwd,
  }
  return { header } as Session
}

function makeTurnEnd(turn: number): SessionEvent {
  return {
    type: 'turn/end',
    seq: SessionSeq(1),
    time: 0,
    data: { turn, reason: { kind: 'completed' } },
  }
}

/** A context whose git and workspace registry services are test doubles. */
function makeContext(status: GitStatus | undefined, workspace: Workspace | undefined) {
  const ctx = new Context()
  const git = new StubGitService(ctx, status)
  const registry = { list: () => (workspace === undefined ? [] : [workspace]) } as WorkspaceRegistry
  return { ctx, git, registry }
}

const twoChanges: readonly GitStatus['changes'] = [
  { path: 'a.txt', state: 'modified', staged: false },
  { path: 'b.txt', state: 'added', staged: false },
]

afterEach(() => {
  vi.useRealTimers()
})

describe('installAutoCommit', () => {
  it('commits once after the debounce window when a bound workspace has changes', async () => {
    vi.useFakeTimers()
    const { ctx, git, registry } = makeContext(makeStatus(twoChanges), makeWorkspace(makeBinding(true)))
    const stop = installAutoCommit(ctx, registry, {
      enabled: true,
      debounceMs: 2_000,
      authorName: 'DeepSeek Harness',
      authorEmail: 'dsh@localhost',
    })

    ctx.emit('session/event', makeSession(), makeTurnEnd(3))
    // The async event handler awaits realpath; flush microtasks so it
    // registers the debounce setTimeout before we advance time.
    await vi.advanceTimersByTimeAsync(0)

    expect(git.commits).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(git.commits).toEqual([{ directory: cwd, message: 'dsh: turn 3 — 2 file(s) changed' }])

    stop()
  })

  it('collapses consecutive turns into the latest one', async () => {
    vi.useFakeTimers()
    const { ctx, git, registry } = makeContext(makeStatus(twoChanges), makeWorkspace(makeBinding(true)))
    const stop = installAutoCommit(ctx, registry, {
      enabled: true,
      debounceMs: 2_000,
      authorName: 'DeepSeek Harness',
      authorEmail: 'dsh@localhost',
    })

    // Emit both turns back-to-back. Both handlers suspend at await realpath.
    ctx.emit('session/event', makeSession(), makeTurnEnd(3))
    ctx.emit('session/event', makeSession(), makeTurnEnd(4))

    // Flush microtasks: both handlers resume. Handler for turn 4 clears
    // turn 3's timer and registers its own.
    await vi.advanceTimersByTimeAsync(0)

    // Advance past the debounce window. Only the collapsed turn 4 timer fires.
    await vi.advanceTimersByTimeAsync(2_000)

    expect(git.commits).toEqual([{ directory: cwd, message: 'dsh: turn 4 — 2 file(s) changed' }])
    stop()
  })

  it('does nothing when the binding has autoCommit disabled', async () => {
    vi.useFakeTimers()
    const { ctx, git, registry } = makeContext(makeStatus(twoChanges), makeWorkspace(makeBinding(false)))
    const stop = installAutoCommit(ctx, registry, {
      enabled: true,
      debounceMs: 2_000,
      authorName: 'DeepSeek Harness',
      authorEmail: 'dsh@localhost',
    })

    ctx.emit('session/event', makeSession(), makeTurnEnd(3))
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2_000)

    expect(git.commits).toHaveLength(0)
    stop()
  })

  it('does nothing when the workspace has no git binding', async () => {
    vi.useFakeTimers()
    const { ctx, git, registry } = makeContext(makeStatus(twoChanges), makeWorkspace(undefined))
    const stop = installAutoCommit(ctx, registry, {
      enabled: true,
      debounceMs: 2_000,
      authorName: 'DeepSeek Harness',
      authorEmail: 'dsh@localhost',
    })

    ctx.emit('session/event', makeSession(), makeTurnEnd(3))
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2_000)

    expect(git.commits).toHaveLength(0)
    stop()
  })

  it('does nothing when the working tree is clean', async () => {
    vi.useFakeTimers()
    const { ctx, git, registry } = makeContext(makeStatus([]), makeWorkspace(makeBinding(true)))
    const stop = installAutoCommit(ctx, registry, {
      enabled: true,
      debounceMs: 2_000,
      authorName: 'DeepSeek Harness',
      authorEmail: 'dsh@localhost',
    })

    ctx.emit('session/event', makeSession(), makeTurnEnd(3))
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2_000)

    expect(git.commits).toHaveLength(0)
    stop()
  })

  it('ignores events that are not turn/end', async () => {
    vi.useFakeTimers()
    const { ctx, git, registry } = makeContext(makeStatus(twoChanges), makeWorkspace(makeBinding(true)))
    const stop = installAutoCommit(ctx, registry, {
      enabled: true,
      debounceMs: 2_000,
      authorName: 'DeepSeek Harness',
      authorEmail: 'dsh@localhost',
    })

    ctx.emit('session/event', makeSession(), {
      type: 'step/end',
      seq: SessionSeq(1),
      time: 0,
      data: { turn: 3, step: 1 },
    })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2_000)

    expect(git.commits).toHaveLength(0)
    stop()
  })

  it('canceling the returned cleanup drops a pending commit', async () => {
    vi.useFakeTimers()
    const { ctx, git, registry } = makeContext(makeStatus(twoChanges), makeWorkspace(makeBinding(true)))
    const stop = installAutoCommit(ctx, registry, {
      enabled: true,
      debounceMs: 2_000,
      authorName: 'DeepSeek Harness',
      authorEmail: 'dsh@localhost',
    })

    ctx.emit('session/event', makeSession(), makeTurnEnd(3))
    await vi.advanceTimersByTimeAsync(0) // flush microtasks to register the timer
    stop()
    await vi.advanceTimersByTimeAsync(2_000)

    expect(git.commits).toHaveLength(0)
  })
})
