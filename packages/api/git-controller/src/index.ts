/**
 * Host Git Remote owner: explicit bind/unbind/commit commands and a
 * reconnect-safe status stream over the git capability seam.
 */

import { Context } from '@deepseek-ai/cordis'
import { Deque } from '@deepseek-ai/dsh-deque'
import type { GitCommit, GitFileChange, GitStatus } from '@deepseek-ai/dsh-git'
import {
  GitArgumentError,
  GitCommandError,
  GitNotRepositoryError,
  GitUnavailableError,
} from '@deepseek-ai/dsh-git'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { Workspace, WorkspaceGitBinding } from '@deepseek-ai/dsh-workspace'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type {
  GitBindInput,
  GitBindingView,
  GitCommitView,
  GitFileView,
  GitRepositoryView,
  GitStatusView,
} from './types.ts'

export type * from './types.ts'

/** Deployment caps on one git status query. */
export interface Config {
  /** Maximum number of commits returned by status and watch. Defaults to 20. */
  readonly maxCommits?: number
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host git business API and Remote namespace owner. */
    gitController: GitController
  }
}

/**
 * Validate maxCommits at construction; fail loud on invalid values.
 * @param value - the raw config value.
 * @returns a positive integer.
 */
function validateMaxCommits(value: unknown): number {
  if (value === undefined) return 20
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error('git-controller config: maxCommits must be a positive safe integer')
  }
  return value
}

/** Host service backing the generated `ctx.remote.git` namespace. */
export class GitController extends TypertRemoteService {
  static inject = ['git', 'workspaceRegistry']

  private readonly maxCommits: number

  /**
   * @param ctx - Host context containing the git service and workspace registry.
   * @param config - deployment caps.
   */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'gitController', { namespace: 'git' })
    // Workspace-scoped calls share the `workspace` resource kind the workspace
    // Remote owner declares; the registry admits one declaration per kind, so
    // this namespace reuses it instead of declaring a second.
    this.maxCommits = validateMaxCommits(config.maxCommits)

    // Forward git events to active followers keyed by directory.
    ctx.on('git/changed', (payload: { readonly directory: string }) => {
      this.feed.changed(payload.directory)
    })
    ctx.on('git/committed', (payload: { readonly directory: string }) => {
      this.feed.changed(payload.directory)
    })
    ctx.effect(() => () => {
      this.feed.closeAll()
    }, 'git-controller.feed')
  }

  // -- feed ---------------------------------------------------------------

  /** Per-directory followers receiving change notifications. */
  private readonly feed = new GitFeed()

  // -- remote methods -----------------------------------------------------

  /**
   * Report the complete git status and recent commits for one workspace.
   * Returns `bound: false` with empty changes and commits when the workspace
   * has no recording binding; returns the live repository info when the
   * directory happens to already be a repo even without a binding.
   * @param workspaceId - target workspace identity.
   * @param signal - caller cancellation.
   * @returns the complete status view.
   */
  @Remote
  async status(workspaceId: WorkspaceId, signal: AbortSignal): Promise<GitStatusView> {
    const workspace = this.getWorkspace(workspaceId)
    return await this.buildStatus(workspace, signal)
  }

  /**
   * Bind a workspace directory to a remote git repository. Initializes git
   * when needed, configures the origin remote, checks out the branch, and
   * records the binding on the workspace.
   * @param workspaceId - target workspace identity.
   * @param input - remote URL, branch, and auto-commit policy.
   * @param signal - caller cancellation.
   * @returns the fresh status view after binding.
   */
  @Remote
  async bind(workspaceId: WorkspaceId, input: GitBindInput, signal: AbortSignal): Promise<GitStatusView> {
    const workspace = this.getWorkspace(workspaceId)
    try {
      await this.ctx.git.bind({ directory: workspace.path, remote: input.remote, branch: input.branch }, signal)
    } catch (error: unknown) {
      throw mapGitError(error)
    }
    await workspace.bindGit({ remote: input.remote, branch: input.branch, autoCommit: input.autoCommit })
    return await this.buildStatus(workspace, signal)
  }

  /**
   * Remove the git binding from a workspace. Does not delete the repository
   * or the remote — only clears the recorded binding on the workspace entity.
   * @param workspaceId - target workspace identity.
   * @param signal - caller cancellation.
   * @returns the status view after unbinding.
   */
  @Remote
  async unbind(workspaceId: WorkspaceId, signal: AbortSignal): Promise<GitStatusView> {
    const workspace = this.getWorkspace(workspaceId)
    await workspace.unbindGit()
    return await this.buildStatus(workspace, signal)
  }

  /**
   * Update only the auto-commit policy of an existing binding.
   * @param workspaceId - target workspace identity.
   * @param autoCommit - new auto-commit policy.
   * @param signal - caller cancellation.
   * @returns the status view after the update.
   */
  @Remote
  async setAutoCommit(workspaceId: WorkspaceId, autoCommit: boolean, signal: AbortSignal): Promise<GitStatusView> {
    const workspace = this.getWorkspace(workspaceId)
    await workspace.setGitAutoCommit(autoCommit)
    return await this.buildStatus(workspace, signal)
  }

  /**
   * Stage all changes and create a commit with the given message.
   * @param workspaceId - target workspace identity.
   * @param message - commit message.
   * @param signal - caller cancellation.
   * @returns the status view after committing.
   * @throws RemoteError with `git/nothing-to-commit` when the tree had no changes.
   */
  @Remote
  async commit(workspaceId: WorkspaceId, message: string, signal: AbortSignal): Promise<GitStatusView> {
    const workspace = this.getWorkspace(workspaceId)
    let result: { readonly committed: boolean; readonly commit?: GitCommit }
    try {
      result = await this.ctx.git.commit({ directory: workspace.path, message }, signal)
    } catch (error: unknown) {
      throw mapGitError(error)
    }
    if (!result.committed) {
      throw new RemoteError('git/nothing-to-commit', 'no changes to commit', {})
    }
    return await this.buildStatus(workspace, signal)
  }

  /**
   * Stream a baseline GitStatusView immediately, then a fresh view whenever
   * the working tree changes or a commit is created in that directory. The
   * stream ends when the caller cancels or the fiber is disposed.
   * @param workspaceId - target workspace identity.
   * @param signal - generation cancellation.
   * @returns baseline followed by status views on each change.
   */
  @Remote({ mode: 'stream' })
  async *watch(workspaceId: WorkspaceId, signal: AbortSignal): AsyncIterable<GitStatusView> {
    const workspace = this.getWorkspace(workspaceId)
    signal.throwIfAborted()
    const follower = this.feed.follow(workspace.path)
    try {
      yield await this.buildStatus(workspace, signal)
      for await (const _trigger of follower.read(signal)) {
        if (signal.aborted) break
        yield await this.buildStatus(workspace, signal)
      }
    } finally {
      this.feed.remove(workspace.path, follower)
      follower.close()
    }
  }

  // -- status assembly ----------------------------------------------------

  /** Resolve a workspace by identity, throwing a typed RemoteError when absent. */
  private getWorkspace(workspaceId: WorkspaceId): Workspace {
    const workspace = this.ctx.workspaceRegistry.get(workspaceId)
    if (workspace === undefined) {
      throw new RemoteError('git/workspace-unknown', `workspace ${workspaceId} not found`, { workspaceId })
    }
    return workspace
  }

  /**
   * Assemble a complete GitStatusView from the live git state and the
   * workspace's recorded binding.
   * @param workspace - resolved workspace whose directory and binding are queried.
   * @param signal - caller cancellation.
   * @returns the assembled status view.
   */
  private async buildStatus(workspace: Workspace, signal: AbortSignal): Promise<GitStatusView> {
    const binding = workspace.git

    let gitStatus: GitStatus | undefined
    try {
      gitStatus = await this.ctx.git.status(workspace.path, signal)
    } catch (error: unknown) {
      // Status failures for non-repository or unavailable git are reported
      // in the view rather than thrown, so the panel always renders.
      if (error instanceof GitNotRepositoryError || error instanceof GitUnavailableError) {
        gitStatus = undefined
      } else {
        throw mapGitError(error)
      }
    }

    let commits: readonly GitCommitView[] = []
    if (gitStatus !== undefined) {
      const log = await this.ctx.git.log(workspace.path, this.maxCommits, signal)
      try {
        commits = log.map(commitView)
      } catch (error: unknown) {
        // Keep commits empty on log failure; status view is still useful.
      }
    }

    return {
      bound: binding !== undefined,
      ...(gitStatus === undefined ? {} : { repository: repositoryView(gitStatus) }),
      ...(binding === undefined ? {} : { binding: bindingView(binding) }),
      clean: gitStatus?.clean ?? true,
      ahead: gitStatus?.ahead ?? 0,
      behind: gitStatus?.behind ?? 0,
      changes: gitStatus?.changes.map(fileView) ?? [],
      commits,
    }
  }
}

export default GitController

// -- view projections -----------------------------------------------------

function fileView(change: GitFileChange): GitFileView {
  return {
    path: change.path,
    state: change.state,
    staged: change.staged,
    ...change.originalPath === undefined ? {} : { originalPath: change.originalPath },
  }
}

function commitView(commit: GitCommit): GitCommitView {
  return {
    oid: commit.oid,
    shortOid: commit.shortOid,
    message: commit.message,
    author: commit.author,
    timestamp: commit.timestamp,
  }
}

function repositoryView(status: GitStatus): GitRepositoryView {
  return {
    root: status.repository.root,
    branch: status.repository.branch,
    ...status.repository.remote === undefined ? {} : { remote: status.repository.remote },
  }
}

function bindingView(binding: WorkspaceGitBinding): GitBindingView {
  return {
    remote: binding.remote,
    branch: binding.branch,
    autoCommit: binding.autoCommit,
    boundAt: binding.boundAt,
  }
}

// -- error mapping --------------------------------------------------------

/** Map a git provider error to a typed RemoteError. */
function mapGitError(error: unknown): never {
  if (error instanceof GitUnavailableError) {
    throw new RemoteError('git/unavailable', 'git executable is not available', {})
  }
  if (error instanceof GitNotRepositoryError) {
    throw new RemoteError('git/not-a-repository', error.message, {})
  }
  if (error instanceof GitCommandError) {
    throw new RemoteError(
      'git/command-failed',
      error.message,
      { command: 'git', exitCode: error.exitCode },
    )
  }
  if (error instanceof GitArgumentError) {
    throw new RemoteError('git/invalid-remote', error.message, {})
  }
  // Unknown errors become `gateway/internal` via the Gateway's rpcFailure
  // wrapper — no explicit git-internal RemoteError code is needed.
  throw error
}

// -- feed ----------------------------------------------------------------

/** One directory's queued change notifications for active followers. */
class GitFollower {
  private readonly triggers = new Deque<void>()
  private waiting: (() => void) | undefined
  private closed = false

  /** Signal one change; wakes the waiting reader. */
  notify(): void {
    if (this.closed) return
    this.triggers.pushBack(undefined)
    this.waiting?.()
  }

  /** Stop the follower; pending reads resolve immediately. */
  close(): void {
    if (this.closed) return
    this.closed = true
    this.waiting?.()
  }

  /** Yield one void trigger per queued change notification. */
  async *read(signal: AbortSignal): AsyncIterable<void> {
    while (!this.closed && !signal.aborted) {
      // Triggers are `void`; `size` distinguishes a queued notification from an
      // empty deque because `popFront()` returns undefined for both.
      if (this.triggers.size > 0) {
        this.triggers.popFront()
        yield
        continue
      }
      await this.wait(signal)
    }
  }

  private wait(signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const finish = (): void => {
        signal.removeEventListener('abort', finish)
        if (this.waiting === finish) this.waiting = undefined
        resolve()
      }
      this.waiting = finish
      signal.addEventListener('abort', finish, { once: true })
      if (signal.aborted || this.closed || this.triggers.size > 0) finish()
    })
  }
}

/** Owns per-directory followers notified on git events. */
class GitFeed {
  private readonly directories = new Map<string, Set<GitFollower>>()

  /** Register a follower for one directory. */
  follow(directory: string): GitFollower {
    const follower = new GitFollower()
    let set = this.directories.get(directory)
    if (set === undefined) {
      set = new Set()
      this.directories.set(directory, set)
    }
    set.add(follower)
    return follower
  }

  /** Remove a follower; cleans up the directory entry when empty. */
  remove(directory: string, follower: GitFollower): void {
    const set = this.directories.get(directory)
    if (set === undefined) return
    set.delete(follower)
    if (set.size === 0) this.directories.delete(directory)
  }

  /** Notify every follower for the given directory. */
  changed(directory: string): void {
    const set = this.directories.get(directory)
    if (set === undefined) return
    for (const follower of set) follower.notify()
  }

  /** Close every follower; called on fiber disposal. */
  closeAll(): void {
    for (const set of this.directories.values()) {
      for (const follower of set) follower.close()
    }
    this.directories.clear()
  }
}
