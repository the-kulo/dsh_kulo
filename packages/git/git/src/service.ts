/**
 * Abstract git Service Definition. Implementations provide the five core
 * operations: discover, bind, status, commit, and log.
 * @module @deepseek-ai/dsh-git
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type {
  GitBindRequest,
  GitCheckoutRequest,
  GitCommit,
  GitCommitRequest,
  GitCommitResult,
  GitPromoteRequest,
  GitRepository,
  GitStatus,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The git capability service. */
    git: GitService
  }

  interface Events {
    /**
     * The working tree or index of a workspace directory changed through a git
     * mutation. Listeners that need the complete status call
     * {@link GitService.status} themselves.
     * @param payload - Identifies the changed directory.
     * @mode emit
     */
    'git/changed'(payload: { readonly directory: string }): void

    /**
     * A commit was created in a workspace directory.
     * @param payload - The directory and the new commit.
     * @mode emit
     */
    'git/committed'(payload: { readonly directory: string; readonly commit: GitCommit }): void
  }
}

/**
 * Abstract git service. One implementation is registered as `ctx.git` per
 * context; loading a second throws (standard cordis duplicate-service behavior).
 *
 * Implementations must honor these semantics:
 * - `discover` returns undefined for a non-repository directory, never throws.
 * - `bind` initializes the directory as a git repository and sets the origin.
 * - `status` reports the complete working-tree status through git porcelain.
 * - `commit` stages everything and commits; returns `{ committed: false }`
 *   when the index has no changes, and emits `git/changed` and `git/committed`.
 * - `log` returns commits newest-first; an empty repository returns `[]`.
 * - All methods accept an optional `AbortSignal` for cancellation.
 */
export abstract class GitService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'git')
  }

  /**
   * Discover the git repository enclosing a directory.
   * @param directory - Absolute path to check.
   * @param signal - Cancels the discovery.
   * @returns the repository, or undefined when the directory is not inside one.
   */
  abstract discover(directory: string, signal?: AbortSignal): Promise<GitRepository | undefined>

  /**
   * Bind a directory to a remote git repository. Initializes git when needed,
   * configures the origin remote, and checks out the branch.
   * @param request - The directory, remote URL, and branch to bind.
   * @param signal - Cancels the operation.
   * @returns the resolved repository after binding.
   */
  abstract bind(request: GitBindRequest, signal?: AbortSignal): Promise<GitRepository>

  /**
   * Report the complete working-tree status of a repository.
   * @param directory - Absolute path inside the repository.
   * @param signal - Cancels the status check.
   * @returns the status, or undefined when the directory is not inside a repository.
   */
  abstract status(directory: string, signal?: AbortSignal): Promise<GitStatus | undefined>

  /**
   * Stage all changes and create a commit with the given message.
   * @param request - The repository directory and commit message.
   * @param signal - Cancels the commit.
   * @returns whether a commit was created, and the commit if so.
   */
  abstract commit(request: GitCommitRequest, signal?: AbortSignal): Promise<GitCommitResult>

  /**
   * List the most recent commits in a repository.
   * @param directory - Absolute path inside the repository.
   * @param limit - Maximum number of commits to return.
   * @param signal - Cancels the log.
   * @returns commits newest-first, or an empty array for an empty repository.
   */
  abstract log(directory: string, limit: number, signal?: AbortSignal): Promise<readonly GitCommit[]>

  /**
   * List the local branch names of a repository.
   * @param directory - Absolute path inside the repository.
   * @param signal - Cancels the listing.
   * @returns branch names, or an empty array before the first commit.
   */
  abstract listBranches(directory: string, signal?: AbortSignal): Promise<readonly string[]>

  /**
   * Check out a branch, creating it from the current HEAD when it is absent.
   * @param request - The repository directory and branch to check out.
   * @param signal - Cancels the checkout.
   * @returns the resolved repository after the checkout.
   */
  abstract checkout(request: GitCheckoutRequest, signal?: AbortSignal): Promise<GitRepository>

  /**
   * Promote one branch into another: check out the target (creating it from
   * the source when absent) and merge the source into it. A conflict aborts
   * the merge, restores the source branch, and throws
   * {@link GitPromotionConflictError}.
   * @param request - The source and target branches.
   * @param signal - Cancels the promotion.
   * @returns the resolved repository after the promotion.
   */
  abstract promote(request: GitPromoteRequest, signal?: AbortSignal): Promise<GitRepository>
}

export default GitService
