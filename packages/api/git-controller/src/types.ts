/**
 * Browser-safe git status, binding, and change vocabulary for the
 * `git` Remote namespace. Types only — generated Remote clients consume
 * this module without Host runtime code.
 * @module @deepseek-ai/dsh-api-git-controller/types
 */

import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'

// Import the protocol module so the declaration at the end of this file
// augments its error map rather than defining an unrelated ambient module.
import type {} from '@deepseek-ai/dsh-typert-protocol'

/** A file state as reported by git status. */
export type GitFileState = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' | 'conflicted'

/** One changed path in the working tree or index, projected for the browser. */
export interface GitFileView {
  /** Repository-relative path with POSIX separators. */
  readonly path: string
  /** The change type git reports. */
  readonly state: GitFileState
  /** True when the change is in the index (staged). */
  readonly staged: boolean
  /** Original path for renames; absent for other states. */
  readonly originalPath?: string
}

/** One commit as returned by git log, projected for the browser. */
export interface GitCommitView {
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

/** The durable git binding recorded on a workspace, projected for the browser. */
export interface GitBindingView {
  /** Remote URL recorded for this workspace. */
  readonly remote: string
  /** Branch that auto-commits target. */
  readonly branch: string
  /** When true, the git consumer commits after each agent turn that changed files. */
  readonly autoCommit: boolean
  /** ISO-8601 instant the binding was recorded. */
  readonly boundAt: string
}

/** The git repository enclosing a workspace directory, projected for the browser. */
export interface GitRepositoryView {
  /** Absolute repository top-level directory. */
  readonly root: string
  /** Current branch name, or 'HEAD' when detached. */
  readonly branch: string
  /** Origin remote URL, when configured. */
  readonly remote?: string
}

/** Complete renderable state of one workspace's git panel. */
export interface GitStatusView {
  /** Whether the workspace has a recorded git binding. */
  readonly bound: boolean
  /** The enclosing repository, present when the directory is inside one. */
  readonly repository?: GitRepositoryView
  /** The recorded binding, present when the workspace is bound. */
  readonly binding?: GitBindingView
  /** True when the working tree and index have no changes. */
  readonly clean: boolean
  /** Commits the local branch is ahead of its upstream. */
  readonly ahead: number
  /** Commits the local branch is behind its upstream. */
  readonly behind: number
  /** Every change the working tree and index hold. */
  readonly changes: readonly GitFileView[]
  /** Recent commits, newest first. */
  readonly commits: readonly GitCommitView[]
}

/** A request to bind a workspace to a remote git repository. */
export interface GitBindInput {
  /** Remote origin URL. */
  readonly remote: string
  /** Branch to check out or create. */
  readonly branch: string
  /** Whether to auto-commit after each agent turn. */
  readonly autoCommit: boolean
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** The git executable could not be resolved. */
    'git/unavailable': {}
    /** The requested remote URL is invalid. */
    'git/invalid-remote': {}
    /** The directory is not inside a git repository. */
    'git/not-a-repository': {}
    /** A git command exited with a non-zero code. */
    'git/command-failed': { readonly command: string; readonly exitCode: number | null }
    /** The working tree had no changes to commit. */
    'git/nothing-to-commit': {}
    /** No registration carries that Workspace identity. */
    'git/workspace-unknown': { readonly workspaceId: WorkspaceId }
  }
}
