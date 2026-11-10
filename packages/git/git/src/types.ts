/**
 * Public types, events, and error classes of the git capability seam.
 * Types only — no runtime code.
 * @module @deepseek-ai/dsh-git
 */

/** Identifies the top-level directory and current state of a git repository. */
export interface GitRepository {
  /** Absolute repository top-level directory. */
  readonly root: string
  /** Absolute .git directory. */
  readonly gitDir: string
  /** Current branch name, or 'HEAD' when detached. */
  readonly branch: string
  /** Origin remote URL, when configured. */
  readonly remote: string | undefined
}

/** A file state as reported by git status. */
export type GitFileState = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' | 'conflicted'

/** One changed path in the working tree or index. */
export interface GitFileChange {
  /** Repository-relative path with POSIX separators. */
  readonly path: string
  /** The change type git reports. */
  readonly state: GitFileState
  /** True when the change is in the index (staged). */
  readonly staged: boolean
  /** Original path for renames; absent for other states. */
  readonly originalPath?: string
}

/** The complete working-tree status of a repository. */
export interface GitStatus {
  /** The repository these changes belong to. */
  readonly repository: GitRepository
  /** True when the working tree and index have no changes. */
  readonly clean: boolean
  /** Commits the local branch is ahead of its upstream. */
  readonly ahead: number
  /** Commits the local branch is behind its upstream. */
  readonly behind: number
  /** Every change the working tree and index hold. */
  readonly changes: readonly GitFileChange[]
}

/** One commit as returned by git log. */
export interface GitCommit {
  /** Full commit object id. */
  readonly oid: string
  /** Abbreviated commit id. */
  readonly shortOid: string
  /** The commit message subject line. */
  readonly message: string
  /** Commit author name. */
  readonly author: string
  /** ISO-8601 commit timestamp. */
  readonly timestamp: string
}

/** A request to bind a directory to a remote git repository. */
export interface GitBindRequest {
  /** Absolute directory to initialize or bind. */
  readonly directory: string
  /** Remote origin URL; must not contain whitespace. */
  readonly remote: string
  /** Branch to check out or create. */
  readonly branch: string
}

/** A request to commit the current working-tree state. */
export interface GitCommitRequest {
  /** Absolute directory of the repository. */
  readonly directory: string
  /** Commit message. */
  readonly message: string
}

/** The result of a commit attempt. */
export interface GitCommitResult {
  /** True when a commit was created. */
  readonly committed: boolean
  /** The created commit; absent when the tree had no changes. */
  readonly commit?: GitCommit
}

/** The git executable could not be resolved. */
export class GitUnavailableError extends Error {
  constructor() {
    super('git executable is not available')
    this.name = 'GitUnavailableError'
  }
}

/** The directory is not inside a git repository. */
export class GitNotRepositoryError extends Error {
  /**
   * @param directory - The directory that was checked.
   */
  constructor(directory: string) {
    super(`not a git repository: ${directory}`)
    this.name = 'GitNotRepositoryError'
  }
}

/** A git command exited with a non-zero code. */
export class GitCommandError extends Error {
  /** The command's exit code. */
  readonly exitCode: number | null
  /** The command's stderr tail. */
  readonly stderr: string

  /**
   * @param args - The command argv that failed.
   * @param exitCode - The process exit code or null.
   * @param stderr - Captured stderr.
   */
  constructor(args: string[], exitCode: number | null, stderr: string) {
    super(`git ${args.join(' ')} failed with exit code ${exitCode}: ${stderr.trim()}`)
    this.name = 'GitCommandError'
    this.exitCode = exitCode
    this.stderr = stderr
  }
}

/** An argument passed to a service method was invalid. */
export class GitArgumentError extends Error {
  /**
   * @param message - Describes which argument and why.
   */
  constructor(message: string) {
    super(message)
    this.name = 'GitArgumentError'
  }
}
