/**
 * React-free Client git panel service: workspace-scoped status stream,
 * bind/unbind/commit commands, and a `useSyncExternalStore`-compatible
 * read/subscribe surface.
 */

import { Service, type Context } from '@deepseek-ai/cordis'
import { RemoteStream, RemoteStreamCarrierError } from '@deepseek-ai/dsh-api-gateway/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { GitBindInput, GitStatusView } from '../types.ts'
import { GitPanelModel } from './model.ts'
import type { GitPanelSnapshot } from './model.ts'

export type { GitPanelSnapshot as GitPanelView }

/** Client git panel service face. */
export interface IGitPanel {
  /** Current panel state; stable identity between mutations. */
  read(): GitPanelSnapshot
  /** Subscribe to panel-state changes; returns the disposer. */
  subscribe(listener: () => void): () => void
  /** Begin streaming the given workspace; switches away from the previous one. */
  follow(workspaceId: WorkspaceId): Promise<void>
  /** Re-fetch the status from the Host for the current workspace. */
  refresh(): Promise<void>
  /** Bind the current workspace to a remote git repository. */
  bind(input: GitBindInput): Promise<void>
  /** Remove the git binding from the current workspace. */
  unbind(): Promise<void>
  /** Update the auto-commit policy of the current workspace. */
  setAutoCommit(autoCommit: boolean): Promise<void>
  /** Stage all changes and commit with the given message. */
  commit(message: string): Promise<void>
}

/**
 * Owns the git panel state and the active watch stream. A workspace switch
 * aborts the previous stream and opens a new one.
 */
export class GitPanel extends Service implements IGitPanel {
  private readonly model = new GitPanelModel()
  /** Active reconnecting stream; disposed on workspace switch or fiber teardown. */
  private stream: RemoteStream<GitStatusView> | undefined

  /** @param ctx - Client root Context. */
  constructor(ctx: Context) {
    super(ctx, 'gitPanel')
    ctx.effect(() => () => {
      this.disposeStream()
    }, 'git-panel.dispose')
  }

  read(): GitPanelSnapshot {
    return this.model.getSnapshot()
  }

  subscribe(listener: () => void): () => void {
    return this.model.subscribe(listener)
  }

  async follow(workspaceId: WorkspaceId): Promise<void> {
    // Dispose the previous stream before opening the new one.
    this.disposeStream()
    this.model.setWorkspace(workspaceId)

    const stream = this.ctx.remote.$stream<GitStatusView>({
      name: 'git status stream',
      open: signal => this.ctx.remote.git.watch(workspaceId, signal),
      ended: accepted => accepted
        ? new RemoteStreamCarrierError('git status stream ended without a terminal result')
        : new Error('git status stream ended before its opening snapshot'),
    })
    this.stream = stream

    // Drive the stream asynchronously; do not block follow() on the first frame.
    this.driveStream(stream).catch((error: unknown) => {
      if (this.stream !== stream) return
      this.model.handleStreamFailure(error)
    })
  }

  async refresh(): Promise<void> {
    const workspaceId = this.model.getSnapshot().workspaceId
    if (workspaceId === undefined) return
    this.model.setLoading()
    const result = await this.ctx.remote.git.status(workspaceId)
    if (result.ok) {
      this.model.installView(result.value)
    } else {
      throw this.model.handleRemoteFailure(result.error, 'refresh')
    }
  }

  async bind(input: GitBindInput): Promise<void> {
    const workspaceId = this.requireWorkspace('bind')
    this.model.setLoading()
    const result = await this.ctx.remote.git.bind(workspaceId, input)
    if (result.ok) {
      this.model.installView(result.value)
    } else {
      throw this.model.handleRemoteFailure(result.error, 'bind')
    }
  }

  async unbind(): Promise<void> {
    const workspaceId = this.requireWorkspace('unbind')
    this.model.setLoading()
    const result = await this.ctx.remote.git.unbind(workspaceId)
    if (result.ok) {
      this.model.installView(result.value)
    } else {
      throw this.model.handleRemoteFailure(result.error, 'unbind')
    }
  }

  async setAutoCommit(autoCommit: boolean): Promise<void> {
    const workspaceId = this.requireWorkspace('setAutoCommit')
    this.model.setLoading()
    const result = await this.ctx.remote.git.setAutoCommit(workspaceId, autoCommit)
    if (result.ok) {
      this.model.installView(result.value)
    } else {
      throw this.model.handleRemoteFailure(result.error, 'setAutoCommit')
    }
  }

  async commit(message: string): Promise<void> {
    const workspaceId = this.requireWorkspace('commit')
    this.model.setLoading()
    const result = await this.ctx.remote.git.commit(workspaceId, message)
    if (result.ok) {
      this.model.installView(result.value)
    } else {
      throw this.model.handleRemoteFailure(result.error, 'commit')
    }
  }

  private requireWorkspace(operation: string): WorkspaceId {
    const workspaceId = this.model.getSnapshot().workspaceId
    if (workspaceId === undefined) {
      throw new Error(`git ${operation}: no workspace is being followed`)
    }
    return workspaceId
  }

  private disposeStream(): void {
    const stream = this.stream
    this.stream = undefined
    void stream?.dispose()
  }

  /** Iterate the reconnecting stream and install each frame into the model. */
  private async driveStream(stream: RemoteStream<GitStatusView>): Promise<void> {
    for await (const item of stream) {
      if (this.stream !== stream) break
      this.model.installView(item.value)
      item.accept()
    }
  }
}
