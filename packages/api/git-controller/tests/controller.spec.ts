/** Host GitController behavior: view projection, error mapping, and the watch feed. */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { GitService } from '@deepseek-ai/dsh-git'
import type {
  GitBindRequest,
  GitCommit,
  GitCommitRequest,
  GitCommitResult,
  GitRepository,
  GitStatus,
} from '@deepseek-ai/dsh-git'
import { GitCommandError, GitNotRepositoryError, GitArgumentError, GitUnavailableError } from '@deepseek-ai/dsh-git'
import type { Workspace, WorkspaceGitBinding, WorkspaceRegistry } from '@deepseek-ai/dsh-workspace'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { GitController } from '../src/index.ts'

const cwd = process.cwd()
const workspaceId = WorkspaceId('ws-1')
const signal = new AbortController().signal

function binding(autoCommit = true): WorkspaceGitBinding {
  return {
    remote: 'git@github.com:org/repo.git',
    branch: 'main',
    autoCommit,
    boundAt: '2026-01-01T00:00:00.000Z',
  }
}

function status(changes: readonly GitStatus['changes']): GitStatus {
  return {
    repository: { root: cwd, gitDir: `${cwd}/.git`, branch: 'main', remote: 'git@github.com:org/repo.git' },
    clean: changes.length === 0,
    ahead: 1,
    behind: 2,
    changes,
  }
}

/** Workspace double that records entity mutations. */
function makeWorkspace(git: WorkspaceGitBinding | undefined, calls: string[]): Workspace {
  const workspace = {
    path: cwd,
    git,
    async bindGit(input: Omit<WorkspaceGitBinding, 'boundAt'>): Promise<WorkspaceGitBinding> {
      calls.push('bindGit')
      workspace.git = { ...input, boundAt: '2026-01-01T00:00:00.000Z' }
      return workspace.git
    },
    async unbindGit(): Promise<void> {
      calls.push('unbindGit')
      workspace.git = undefined
    },
    async setGitAutoCommit(autoCommit: boolean): Promise<void> {
      calls.push('setGitAutoCommit')
      if (workspace.git !== undefined) workspace.git = { ...workspace.git, autoCommit }
    },
  } as Workspace
  return workspace
}

/** Registry double returning one workspace. */
function makeRegistry(workspace: Workspace | undefined): WorkspaceRegistry {
  return { get: () => workspace } as WorkspaceRegistry
}

/** Git capability double with scripted results and recorded calls. */
class StubGitService extends GitService {
  statusResult: GitStatus | undefined = undefined
  statusError: Error | undefined = undefined
  bindError: Error | undefined = undefined
  logResult: readonly GitCommit[] = []
  commitResult: GitCommitResult = {
    committed: true,
    commit: {
      oid: 'f0e1d2c3b4a5968778695a4b3c2d1e0f19283746',
      shortOid: 'f0e1d2c',
      message: 'committed',
      author: 'DeepSeek Harness',
      timestamp: '2026-01-01T00:00:00.000Z',
    },
  }

  readonly binds: GitBindRequest[] = []
  readonly commits: GitCommitRequest[] = []

  constructor(ctx: Context) {
    super(ctx)
  }

  async discover(): Promise<GitRepository | undefined> {
    return undefined
  }

  async bind(request: GitBindRequest): Promise<GitRepository> {
    if (this.bindError !== undefined) throw this.bindError
    this.binds.push(request)
    return {
      root: request.directory,
      gitDir: `${request.directory}/.git`,
      branch: request.branch,
      remote: request.remote,
    }
  }

  async commit(request: GitCommitRequest): Promise<GitCommitResult> {
    this.commits.push(request)
    return this.commitResult
  }

  async log(): Promise<readonly GitCommit[]> {
    return this.logResult
  }

  async status(): Promise<GitStatus | undefined> {
    if (this.statusError !== undefined) throw this.statusError
    return this.statusResult
  }
}

function makeController(workspace: Workspace | undefined) {
  const ctx = new Context()
  const git = new StubGitService(ctx)
  ctx.provide('workspaceRegistry', makeRegistry(workspace))
  const controller = new GitController(ctx, {})
  return { ctx, git, controller }
}

const oneChange: readonly GitStatus['changes'] = [
  { path: 'a.txt', state: 'modified', staged: false },
]

describe('GitController', () => {
  it('projects status, binding, and changes for a bound workspace', async () => {
    const calls: string[] = []
    const { git, controller } = makeController(makeWorkspace(binding(), calls))
    git.statusResult = status(oneChange)

    const view = await controller.status(workspaceId, signal)

    expect(view.bound).toBe(true)
    expect(view.repository).toEqual({ root: cwd, branch: 'main', remote: 'git@github.com:org/repo.git' })
    expect(view.binding).toEqual(binding())
    expect(view.clean).toBe(false)
    expect(view.ahead).toBe(1)
    expect(view.behind).toBe(2)
    expect(view.changes).toEqual([{ path: 'a.txt', state: 'modified', staged: false }])
    expect(view.commits).toEqual([])
  })

  it('reports an unbound workspace without a repository as clean', async () => {
    const { git, controller } = makeController(makeWorkspace(undefined, []))
    git.statusResult = undefined

    const view = await controller.status(workspaceId, signal)

    expect(view.bound).toBe(false)
    expect(view.repository).toBeUndefined()
    expect(view.clean).toBe(true)
    expect(view.changes).toEqual([])
  })

  it('binds through the git service and records the workspace binding', async () => {
    const calls: string[] = []
    const workspace = makeWorkspace(undefined, calls)
    const { git, controller } = makeController(workspace)
    git.statusResult = status(oneChange)

    const view = await controller.bind(workspaceId, {
      remote: 'git@github.com:org/repo.git',
      branch: 'main',
      autoCommit: true,
    }, signal)

    expect(git.binds).toEqual([{ directory: cwd, remote: 'git@github.com:org/repo.git', branch: 'main' }])
    expect(calls).toContain('bindGit')
    expect(view.bound).toBe(true)
    expect(view.binding?.remote).toBe('git@github.com:org/repo.git')
  })

  it('unbinds the workspace binding', async () => {
    const calls: string[] = []
    const { controller } = makeController(makeWorkspace(binding(), calls))
    const view = await controller.unbind(workspaceId, signal)

    expect(calls).toContain('unbindGit')
    expect(view.bound).toBe(false)
  })

  it('updates only the auto-commit policy', async () => {
    const calls: string[] = []
    const workspace = makeWorkspace(binding(true), calls)
    const { controller } = makeController(workspace)

    const view = await controller.setAutoCommit(workspaceId, false, signal)

    expect(calls).toContain('setGitAutoCommit')
    expect(view.binding?.autoCommit).toBe(false)
    expect(view.binding?.remote).toBe('git@github.com:org/repo.git')
    expect(workspace.git?.autoCommit).toBe(false)
  })

  it('commits with the workspace directory and message', async () => {
    const { git, controller } = makeController(makeWorkspace(binding(), []))
    git.statusResult = status(oneChange)

    await controller.commit(workspaceId, 'manual commit', signal)

    expect(git.commits).toEqual([{ directory: cwd, message: 'manual commit' }])
  })

  it('maps a clean tree to git/nothing-to-commit', async () => {
    const { git, controller } = makeController(makeWorkspace(binding(), []))
    git.commitResult = { committed: false }

    await expect(controller.commit(workspaceId, 'empty', signal))
      .rejects.toMatchObject({ isDSHRemoteError: true, code: 'git/nothing-to-commit' })
  })

  it('keeps a not-a-repository status as a clean unbound view', async () => {
    const { git, controller } = makeController(makeWorkspace(binding(), []))
    git.statusError = new GitNotRepositoryError(cwd)

    const view = await controller.status(workspaceId, signal)

    expect(view.bound).toBe(true)
    expect(view.repository).toBeUndefined()
    expect(view.clean).toBe(true)
  })

  it('maps a git command failure to git/command-failed', async () => {
    const { git, controller } = makeController(makeWorkspace(binding(), []))
    git.statusError = new GitCommandError(['status'], 1, 'boom')

    await expect(controller.status(workspaceId, signal))
      .rejects.toMatchObject({ isDSHRemoteError: true, code: 'git/command-failed' })
  })

  it('maps an unknown workspace to git/workspace-unknown', async () => {
    const { controller } = makeController(undefined)

    await expect(controller.status(workspaceId, signal))
      .rejects.toMatchObject({ isDSHRemoteError: true, code: 'git/workspace-unknown' })
  })

  it('maps a GitArgumentError to git/invalid-remote', async () => {
    const { git, controller } = makeController(makeWorkspace(undefined, []))
    git.bindError = new GitArgumentError('invalid remote URL')

    await expect(controller.bind(workspaceId, { remote: 'bad', branch: 'main', autoCommit: true }, signal))
      .rejects.toMatchObject({ isDSHRemoteError: true, code: 'git/invalid-remote' })
  })

  it('maps a GitUnavailableError to git/unavailable', async () => {
    const { git, controller } = makeController(makeWorkspace(undefined, []))
    git.bindError = new GitUnavailableError()

    await expect(controller.bind(workspaceId, { remote: 'git@github.com:org/repo.git', branch: 'main', autoCommit: true }, signal))
      .rejects.toMatchObject({ isDSHRemoteError: true, code: 'git/unavailable' })
  })

  it('maps a GitNotRepositoryError from bind to git/not-a-repository', async () => {
    const { git, controller } = makeController(makeWorkspace(undefined, []))
    git.bindError = new GitNotRepositoryError(cwd)

    await expect(controller.bind(workspaceId, { remote: 'git@github.com:org/repo.git', branch: 'main', autoCommit: true }, signal))
      .rejects.toMatchObject({ isDSHRemoteError: true, code: 'git/not-a-repository' })
  })

  it('projects commits from the git log', async () => {
    const { git, controller } = makeController(makeWorkspace(binding(), []))
    git.statusResult = status(oneChange)
    git.logResult = [
      {
        oid: 'f0e1d2c3b4a5968778695a4b3c2d1e0f19283746',
        shortOid: 'f0e1d2c',
        message: 'first commit',
        author: 'DeepSeek Harness',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ]

    const view = await controller.status(workspaceId, signal)

    expect(view.commits).toEqual([
      { oid: 'f0e1d2c3b4a5968778695a4b3c2d1e0f19283746', shortOid: 'f0e1d2c', message: 'first commit', author: 'DeepSeek Harness', timestamp: '2026-01-01T00:00:00.000Z' },
    ])
  })

  it('streams a baseline and a fresh view on git/changed', async () => {
    const { ctx, git, controller } = makeController(makeWorkspace(binding(), []))
    git.statusResult = status(oneChange)

    const iterator = controller.watch(workspaceId, signal)
    const first = await iterator.next()
    expect(first.done).toBe(false)
    expect(first.value.changes).toEqual([{ path: 'a.txt', state: 'modified', staged: false }])

    git.statusResult = status([{ path: 'b.txt', state: 'added', staged: true }])
    ctx.emit('git/changed', { directory: cwd })
    const second = await iterator.next()
    expect(second.done).toBe(false)
    expect(second.value.changes).toEqual([{ path: 'b.txt', state: 'added', staged: true }])

    await iterator.return?.(undefined)
  })

  it('rejects watch for an unknown workspace', async () => {
    const { controller } = makeController(undefined)
    const iterator = controller.watch(workspaceId, signal)

    await expect(iterator.next())
      .rejects.toMatchObject({ isDSHRemoteError: true, code: 'git/workspace-unknown' })
    await iterator.return?.(undefined)
  })
})
