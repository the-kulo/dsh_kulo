/**
 * Client-side git panel state model: holds the current GitStatusView and
 * manages workspace identity tracking for the stream.
 */

import { isRemoteFailure } from '@deepseek-ai/dsh-api-gateway/client'
// Type-only: pulls the generated `ctx.remote.git` namespace into this program.
import type {} from '@deepseek-ai/dsh-api-git-controller/remote'
import { notifySubscribers } from '@deepseek-ai/dsh-client-store'
import type { RemoteFailure, TypertClientRemote } from '@deepseek-ai/dsh-typert-protocol'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { GitStatusView } from '../types.ts'

/** Complete generated `ctx.remote.git` namespace. */
export type GitRemote = TypertClientRemote['git']

/** Panel lifecycle phase. */
export type GitPanelPhase = 'idle' | 'loading' | 'ready' | 'error'

/** Immutable client git panel state. */
export interface GitPanelSnapshot {
  readonly workspaceId: WorkspaceId | undefined
  readonly status: GitPanelPhase
  readonly view: GitStatusView | undefined
  readonly error: string | undefined
}

/**
 * Owns the client git panel projection, updated by the stream and unary
 * command echoes.
 */
export class GitPanelModel {
  private workspaceId: WorkspaceId | undefined
  private phase: GitPanelPhase = 'idle'
  private view: GitStatusView | undefined
  private error: string | undefined
  private readonly listeners = new Set<() => void>()
  private snapshotCache: GitPanelSnapshot
  private snapshotDirty = false
  private notificationPending = false
  private notificationScheduled = false
  private notificationGeneration = 0

  constructor() {
    this.snapshotCache = this.buildSnapshot()
  }

  /** Set the active workspace identity; clears the current view. */
  setWorkspace(workspaceId: WorkspaceId): void {
    if (this.workspaceId === workspaceId) return
    this.workspaceId = workspaceId
    this.view = undefined
    this.phase = 'loading'
    this.error = undefined
    this.invalidate()
  }

  /** Install a status view from the watch stream. */
  installView(view: GitStatusView): void {
    this.view = view
    this.phase = 'ready'
    this.error = undefined
    this.invalidate()
  }

  /** Report a stream or command error to the panel. */
  setError(message: string): void {
    this.phase = 'error'
    this.error = message
    this.invalidate()
  }

  /** Set the panel to loading state. */
  setLoading(): void {
    this.phase = 'loading'
    this.error = undefined
    this.invalidate()
  }

  /**
   * Read the cached state, rebuilding it first when necessary.
   * @returns the current stable git panel snapshot.
   */
  getSnapshot(): GitPanelSnapshot {
    this.refreshSnapshot()
    return this.snapshotCache
  }

  /**
   * Subscribe to panel state invalidation.
   * @param listener - invalidation callback.
   * @returns unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Map a RemoteFailure to a readable error message and publish it.
   * @param failure - the remote failure.
   * @param context - what was being attempted.
   * @returns an Error for the caller to throw.
   */
  handleRemoteFailure(failure: RemoteFailure, context: string): Error {
    const message = `git ${context} failed: ${failure.code}: ${failure.message}`
    this.setError(message)
    return new Error(message)
  }

  /**
   * Handle a terminal stream or protocol failure.
   * @param error - the failure.
   */
  handleStreamFailure(error: unknown): void {
    if (!isRemoteFailure(error)) {
      this.setError(error instanceof Error ? error.message : 'git stream failed')
      return
    }
    this.setError(`${error.code}: ${error.message}`)
  }

  private buildSnapshot(): GitPanelSnapshot {
    return {
      workspaceId: this.workspaceId,
      status: this.phase,
      view: this.view,
      error: this.error,
    }
  }

  private refreshSnapshot(): void {
    if (!this.snapshotDirty) return
    this.snapshotDirty = false
    this.snapshotCache = this.buildSnapshot()
  }

  private invalidate(immediate = false): void {
    this.snapshotDirty = true
    this.notificationPending = true
    if (immediate) {
      this.notificationGeneration++
      this.notificationScheduled = false
      this.flush()
      return
    }
    if (this.notificationScheduled) return
    this.notificationScheduled = true
    const generation = ++this.notificationGeneration
    queueMicrotask(() => {
      if (generation !== this.notificationGeneration) return
      this.notificationScheduled = false
      this.flush()
    })
  }

  private flush(): void {
    if (!this.notificationPending || this.listeners.size === 0) return
    this.notificationPending = false
    this.refreshSnapshot()
    notifySubscribers(this.listeners, '[git-controller]')
  }
}
