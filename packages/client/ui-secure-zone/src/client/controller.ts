/** Secure-zone history restore, session management, and derived browser observables. */

import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { IWorkspaces } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionSearchResultItem } from '@deepseek-ai/dsh-api-session-controller/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SecureZoneKey } from './locales.ts'
import type { createSecureZoneStore } from './stores.ts'

/** Agent preset whose Sessions the panel reads; composed without tools or runtime context. */
export const SECURE_PRESET_ID = 'secure'

/** Archived-row visibility the panel's view options switch between. */
export type SecureZoneArchivedFilter = 'default' | 'show' | 'only'

/**
 * The zone's list viewing knobs: the ordering and archived filter the
 * accordion header's view options persist in the Workspace browser's store.
 * The controller's {@link SecureZoneController.setListView} re-derives the
 * published list when the owner share reports a change.
 */
export interface SecureZoneListView {
  orderBy: 'manual' | 'updated'
  archivedFilter: SecureZoneArchivedFilter
  /** Title filter draft the zone's header search writes; '' means no filter. */
  query: string
}

type SecureZoneView = ReturnType<ReturnType<typeof createSecureZoneStore>['create']>

/** One standalone secure-zone conversation in the zone's history list. */
export interface SecureZoneSessionItem {
  readonly id: SessionId
  readonly title: string
  /** Last activity (creation or latest prompt) in epoch ms; drives row order and the row's trailing relative time. */
  readonly updatedAt: number
  /**
   * No first prompt yet: the New Session placeholder row. Only the blank
   * Session the Main view retains lists — a completed one disappears on open,
   * like the Workspace browser's own blank rule.
   */
  readonly blank: boolean
  /** The Session the Main view currently retains. */
  readonly current: boolean
  /** Whether the Session is archived (hidden from the default list). */
  readonly archived: boolean
  /** Whether the Session is pinned (sorted before unpinned rows). */
  readonly pinned: boolean
}

function isSecureZoneIdentity(id: SessionId): boolean {
  return id.startsWith('securezone-')
}

/** Read-only owner of the secure-zone conversation list. */
export class SecureZoneController {
  /** Standalone secure-zone conversations, pinned first then ordered by the zone's view options. */
  readonly sessionItems = createSnapshotStore<readonly SecureZoneSessionItem[]>([])

  private listSubscription: (() => void) | null = null
  private workspaceSubscription: (() => void) | null = null
  private disposed = false
  private listView: SecureZoneListView = { orderBy: 'manual', archivedFilter: 'default', query: '' }

  constructor(
    private readonly ctx: ClientContext,
    private readonly sessions: ISessions,
    private readonly workspaces: IWorkspaces,
    private readonly workspace: UiWorkspace,
    private readonly view: SecureZoneView,
  ) {}

  /**
   * Create one independent secure-zone Session and show it as the current
   * Main Session. `quick: true` keeps it outside every Workspace; the preset
   * id maps to the gateway's secure zone, whose routing forces the local
   * self-deployed model `LKL-GLM-5.2-FP8` and forbids external tools.
   */
  async createSession(): Promise<void> {
    const sessionId = await this.sessions.create({ quick: true, agentPreset: SECURE_PRESET_ID })
    this.workspace.openSession(sessionId)
  }

  /** Open one listed conversation as the current Main Session. */
  openSession(sessionId: SessionId): void {
    this.workspace.openSession(sessionId)
  }

  /**
   * Search conversation content on the Host, bounded like the Workspace
   * browser's search; the panel intersects the hits with its own zone list.
   * @param query - non-blank literal phrase.
   * @param signal - cancellation for a superseded search.
   * @returns bounded results, or a business/transport error.
   */
  async searchSessions(
    query: string,
    signal: AbortSignal,
  ): Promise<{ items: readonly SessionSearchResultItem[]; hasMore: boolean }> {
    const result = await this.sessions.search(query, signal)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }

  /**
   * Apply the persisted zone list view (ordering + archived filter) the
   * panel's header view options report, then republish the derived list.
   * @param view - the zone's current view options from the Workspace browser's store.
   */
  setListView(view: SecureZoneListView): void {
    if (view.orderBy === this.listView.orderBy && view.archivedFilter === this.listView.archivedFilter) return
    this.listView = view
    this.refresh()
  }

  /** Follow the secure-zone conversation list without creating an Agent. */
  async start(): Promise<void> {
    this.listSubscription ??= this.sessions.list.subscribe(() => { this.refresh() })
    this.workspaceSubscription ??= this.workspaces.list.subscribe(() => { this.refresh() })
    await this.sessions.refresh().catch((error: unknown) => { this.fail(error) })
    this.refresh()
  }

  private refresh(): void {
    if (this.disposed) return
    const snapshot = this.sessions.list.getSnapshot()
    const workspaceSnapshot = this.workspaces.list.getSnapshot()
    const archivedSet = new Set(workspaceSnapshot.archivedSessionIds)
    const pinnedSet = new Set(workspaceSnapshot.pinnedSessionIds)
    const current = Object.values(snapshot.byId)
      .find(session => (session.retainedBy.mainView ?? 0) > 0)?.id
    const items = [...snapshot.ids].reverse()
      .filter(id => isSecureZoneIdentity(id) || snapshot.byId[id]?.projectionValues?.agentPreset === SECURE_PRESET_ID)
      .map(id => ({
        id,
        title: snapshot.byId[id]?.title?.trim() ?? '',
        updatedAt: snapshot.byId[id]?.updatedAt ?? 0,
        blank: snapshot.byId[id]?.blank ?? false,
        current: id === current,
        archived: archivedSet.has(id),
        pinned: pinnedSet.has(id),
      }))
      .filter(item => !item.blank || item.current)
    const visible = items
      .filter(item => this.listView.archivedFilter === 'show' || (this.listView.archivedFilter === 'only') === item.archived)
      .sort((left, right) => {
        if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
        if (this.listView.orderBy === 'updated') return right.updatedAt - left.updatedAt
        return 0
      })
    this.sessionItems.set(visible)
  }

  /**
   * Rename a secure-zone Session and refresh the zone list.
   * @param sessionId - Session to rename.
   * @param title - new title.
   */
  async renameSession(sessionId: SessionId, title: string): Promise<void> {
    const result = await this.sessions.using(
      sessionId,
      { source: 'secureZoneRename' },
      reference => reference.binding.session.rename(title),
    )
    if (!result.ok) throw new Error(result.error.message)
  }

  /**
   * Permanently delete a secure-zone Session and its stored log.
   * @param sessionId - Session to delete.
   */
  async deleteSession(sessionId: SessionId): Promise<void> {
    await this.sessions.delete(sessionId)
  }

  /**
   * Archive a secure-zone Session; the zone list hides it on the next
   * Workspace-list notification.
   * @param sessionId - Session to archive.
   */
  async archiveSession(sessionId: SessionId): Promise<void> {
    await this.workspace.archiveSession(sessionId)
  }

  /**
   * Unarchive a secure-zone Session; it re-enters the zone list.
   * @param sessionId - Session to unarchive.
   */
  async unarchiveSession(sessionId: SessionId): Promise<void> {
    await this.workspace.unarchiveSession(sessionId)
  }

  /**
   * Pin a secure-zone Session; it leads the zone list on the next
   * Workspace-list notification.
   * @param sessionId - Session to pin.
   */
  async pinSession(sessionId: SessionId): Promise<void> {
    await this.workspace.pinSession(sessionId)
  }

  /**
   * Unpin a secure-zone Session; its saved position stays as it is.
   * @param sessionId - Session to unpin.
   */
  async unpinSession(sessionId: SessionId): Promise<void> {
    await this.workspace.unpinSession(sessionId)
  }

  /** Release the list subscriptions. */
  dispose(): void {
    this.disposed = true
    this.listSubscription?.()
    this.listSubscription = null
    this.workspaceSubscription?.()
    this.workspaceSubscription = null
  }

  private t(key: SecureZoneKey): string {
    return this.ctx.locale.bind('securezone')(key)
  }

  private fail(error: unknown): void {
    if (!this.disposed) this.view.actions.setFailures([this.t('error.offline'), error instanceof Error ? error.message : String(error)])
  }
}
