/** Quick answers history restore, session management, and derived browser observables. */

import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { IWorkspaces } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { QuickQaKey } from './locales.ts'
import type { createQuickQaStore } from './stores.ts'

/** Agent preset whose Sessions the panel reads; composed without tools or runtime context. */
export const QUICK_QA_PRESET_ID = 'quick-qa'

/** Archived-row visibility the panel's view options switch between. */
export type QuickQaArchivedFilter = 'default' | 'show' | 'only'

/**
 * The zone's list viewing knobs: the ordering and archived filter the
 * accordion header's view options persist in the Workspace browser's store.
 * The controller's {@link QuickQaController.setListView} re-derives the
 * published list when the owner share reports a change.
 */
export interface QuickQaListView {
  orderBy: 'manual' | 'updated'
  archivedFilter: QuickQaArchivedFilter
  /** Title filter draft the zone's header search writes; '' means no filter. */
  query: string
}

type QuickQaView = ReturnType<ReturnType<typeof createQuickQaStore>['create']>

/** One standalone quick-answer conversation in the zone's history list. */
export interface QuickQaSessionItem {
  readonly id: SessionId
  readonly title: string
  /** Last update epoch ms from the Session list summary; drives the row's relative time. */
  readonly updatedAt: number
  /** A blank Session has no first prompt yet; its row shows the New Session label and no time. */
  readonly blank: boolean
  /** Whether the Session is archived (hidden from the default list). */
  readonly archived: boolean
  /** Whether the Session is pinned (sorted before unpinned rows). */
  readonly pinned: boolean
}

function isQuickQaIdentity(id: SessionId): boolean {
  return id.startsWith('quickqa-')
}

/**
 * Owner of the quick-answer zone's conversation list and its per-session
 * management actions. The list re-derives from the Session Controller's
 * Host-authoritative catalog plus the Workspace Controller's registry-global
 * archive/pin sets; actions write through the same services so the next
 * `sessions.list` / `workspaces.list` notification refreshes the zone.
 */
export class QuickQaController {
  /** Standalone quick-answer conversations, pinned first then newest first, archived excluded. */
  readonly sessionItems = createSnapshotStore<readonly QuickQaSessionItem[]>([])

  private listSubscription: (() => void) | null = null
  private workspaceSubscription: (() => void) | null = null
  private disposed = false
  private listView: QuickQaListView = { orderBy: 'manual', archivedFilter: 'default', query: '' }

  constructor(
    private readonly ctx: ClientContext,
    private readonly sessions: ISessions,
    private readonly workspaces: IWorkspaces,
    private readonly workspace: UiWorkspace,
    private readonly view: QuickQaView,
  ) {}

  /**
   * Create one independent quick-answer Session and show it as the current
   * Main Session. `quick: true` keeps it outside every Workspace; the preset
   * id maps to the gateway's quick-qa zone for model routing.
   */
  async createSession(): Promise<void> {
    const sessionId = await this.sessions.create({ quick: true, agentPreset: QUICK_QA_PRESET_ID })
    this.workspace.openSession(sessionId)
  }

  /** Open one listed conversation as the current Main Session. */
  openSession(sessionId: SessionId): void {
    this.workspace.openSession(sessionId)
  }

  /**
   * Apply the persisted zone list view (ordering + archived filter) the
   * panel's header view options report. The controller owns the list
   * derivation and the store stays presentation state, so the knobs live in
   * the controller and the panel's one write back lands here.
   * @param view - the zone's current view options from the Workspace browser's store.
   */
  setListView(view: QuickQaListView): void {
    if (view.orderBy === this.listView.orderBy && view.archivedFilter === this.listView.archivedFilter) return
    this.listView = view
    this.refresh()
  }

  /** Follow the quick-answer conversation list without creating an Agent. */
  async start(): Promise<void> {
    this.listSubscription ??= this.sessions.list.subscribe(() => { this.refresh() })
    this.workspaceSubscription ??= this.workspaces.list.subscribe(() => { this.refresh() })
    await this.sessions.refresh().catch((error: unknown) => { this.fail(error) })
    this.refresh()
  }

  private refresh(): void {
    if (this.disposed) return
    const listView = this.listView
    const snapshot = this.sessions.list.getSnapshot()
    const workspaceSnapshot = this.workspaces.list.getSnapshot()
    const archivedSet = new Set(workspaceSnapshot.archivedSessionIds)
    const pinnedSet = new Set(workspaceSnapshot.pinnedSessionIds)
    const items = [...snapshot.ids].reverse()
      .filter(id => isQuickQaIdentity(id) || snapshot.byId[id]?.projectionValues?.agentPreset === QUICK_QA_PRESET_ID)
      .map((id): QuickQaSessionItem => {
        const summary = snapshot.byId[id]
        return {
          id,
          title: summary?.title?.trim() ?? '',
          updatedAt: summary?.updatedAt ?? 0,
          blank: summary?.blank ?? false,
          archived: archivedSet.has(id),
          pinned: pinnedSet.has(id),
        }
      })
    const visible = items
      .filter(item => listView.archivedFilter === 'show' || (listView.archivedFilter === 'only') === item.archived)
      .sort((left, right) => {
        if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
        if (listView.orderBy === 'updated') return right.updatedAt - left.updatedAt
        return 0
      })
    this.sessionItems.set(visible)
  }

  /**
   * Rename a quick-answer Session and refresh the zone list.
   * @param sessionId - Session to rename.
   * @param title - new title.
   */
  async renameSession(sessionId: SessionId, title: string): Promise<void> {
    const result = await this.sessions.using(
      sessionId,
      { source: 'quickQaPanel' },
      reference => reference.binding.session.rename(title),
    )
    if (!result.ok) throw new Error(result.error.message)
  }

  /**
   * Permanently delete a quick-answer Session and its stored log.
   * @param sessionId - Session to delete.
   */
  async deleteSession(sessionId: SessionId): Promise<void> {
    await this.sessions.delete(sessionId)
  }

  /**
   * Archive a quick-answer Session; the zone list hides it on the next
   * Workspace-list notification.
   * @param sessionId - Session to archive.
   */
  async archiveSession(sessionId: SessionId): Promise<void> {
    await this.workspace.archiveSession(sessionId)
  }

  /**
   * Unarchive a quick-answer Session; it re-enters the zone list.
   * @param sessionId - Session to unarchive.
   */
  async unarchiveSession(sessionId: SessionId): Promise<void> {
    await this.workspace.unarchiveSession(sessionId)
  }

  /**
   * Pin a quick-answer Session; it leads the zone list on the next
   * Workspace-list notification.
   * @param sessionId - Session to pin.
   */
  async pinSession(sessionId: SessionId): Promise<void> {
    await this.workspace.pinSession(sessionId)
  }

  /**
   * Unpin a quick-answer Session; its saved position stays as it is.
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

  private t(key: QuickQaKey): string {
    return this.ctx.locale.bind('quickqa')(key)
  }

  private fail(error: unknown): void {
    if (!this.disposed) this.view.actions.setFailures([this.t('error.offline'), error instanceof Error ? error.message : String(error)])
  }
}
