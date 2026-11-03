/**
 * The workspace browser's viewing store: the session-list grouping mode,
 * persisted across reloads. Module level exports the factory only (a
 * module-level handle would pin the store identity across plugin reloads);
 * register() receives the factory and the browser derives its PropsStore
 * share from the return type.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { reconcileManualOrder, type ArchivedFilter, type SessionRowState } from './tree.ts'

/** Browser-local order account for the hierarchy-free flat Session list. */
export const FLAT_SESSION_ORDER_KEY = '__flat_session_order__'

/** Session-list grouping mode: sibling Workspace sections, a Workspace tree, or one flat list. */
export type SessionGroupBy = 'workspace' | 'workspace-tree' | 'flat'
/** Session order: saved manual positions or current recency. */
export type SessionOrderBy = 'manual' | 'updated'

/** Sidebar zones that share the Workspace browser's chrome; the workspace zone carries the browsing list. */
export type SidebarZoneKey = 'workspace' | 'quick-qa' | 'secure'

/**
 * One zone's list viewing state. Zones without Workspaces keep no grouping
 * choice; a zone's persisted ordering is its view-options selection (the
 * quick-qa and secure zones reorder their flat lists through it), while the
 * workspace zone keeps its own manual-order accounts above.
 */
export type ZoneListViewState = {
  orderBy: SessionOrderBy
  archivedFilter: ArchivedFilter
  /** Title filter draft the zone's header search writes; '' means no filter. */
  query: string
  /** Saved manual order for flat zones without Workspace grouping; recency fallback when absent. */
  manualOrder?: readonly SessionId[]
}

/** Workspace browser viewing state persisted across surface remounts and reloads. */
type WorkspaceViewState = {
  groupBy: SessionGroupBy
  orderBy: SessionOrderBy
  /** Explicit group expansion keyed by Workspace identity, including descendants in tree mode. */
  groupExpansion: Record<string, boolean>
  /** Saved manual order per Workspace group plus the browser-local flat-list account. */
  sessionOrderByAccount: Record<string, string[]>
  /** Archived-row visibility; omitted in pre-filter v5 snapshots and read as 'default'. */
  archivedFilter?: ArchivedFilter
  /** Sidebar zone-accordion expansion, mutually exclusive across the workspace/quick-qa/secure zones; omitted in pre-zone v6 snapshots and read as expanded. */
  zoneExpansion?: Record<string, boolean>
  /** Per-zone list viewing state for the quick-qa and secure zones; omitted in pre-zone-view v6 snapshots and read as recency order with archived rows hidden. */
  zoneListView?: Record<string, ZoneListViewState>
}

type SessionOrderSource = {
  members: Readonly<Record<string, readonly SessionId[]>>
  summaries: SessionListState['byId']
  rowState: Pick<SessionRowState, 'pinnedSessionIds' | 'archivedSessionIds'>
}

/**
 * Annotation twin of the actions literal below (the export needs a declared
 * return type); drift fails assignability at the defineStore call.
 */
type WorkspaceViewActions = {
  setGroupBy: (draft: WorkspaceViewState, mode: SessionGroupBy) => void
  setOrderBy: (
    draft: WorkspaceViewState,
    mode: SessionOrderBy,
    initialOrders: Readonly<Record<string, readonly string[]>>,
  ) => void
  setGroupExpanded: (draft: WorkspaceViewState, key: string, expanded: boolean) => void
  retainAccountKeys: (draft: WorkspaceViewState, workspaceKeys: readonly string[]) => void
  syncSessionOrders: (
    draft: WorkspaceViewState,
    orders: Readonly<Record<string, readonly string[]>>,
  ) => void
  setSessionOrder: (
    draft: WorkspaceViewState,
    accountKey: string,
    order: readonly string[],
    initialOrders: Readonly<Record<string, readonly string[]>>,
  ) => void
  pinSessionOrder: (
    draft: WorkspaceViewState,
    sessionId: string,
    accountKeys: readonly string[],
    source: SessionOrderSource,
  ) => void
  setArchivedFilter: (draft: WorkspaceViewState, filter: ArchivedFilter) => void
  setZoneExpanded: (draft: WorkspaceViewState, zoneKey: string, expanded: boolean) => void
  setZoneListView: (draft: WorkspaceViewState, zoneKey: SidebarZoneKey, view: Partial<ZoneListViewState>) => void
}

/** Copy read-only projections into the persisted mutable store representation. */
function copySessionOrders(
  orders: Readonly<Record<string, readonly string[]>>,
): Record<string, string[]> {
  return Object.fromEntries(Object.entries(orders).map(([key, order]) => [key, [...order]]))
}

/**
 * Create the workspace browser viewing store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createWorkspaceViewStore(): EngineStoreHandle<WorkspaceViewState, WorkspaceViewActions> {
  return defineStore({
    init: (): WorkspaceViewState => ({
      groupBy: 'workspace',
      orderBy: 'updated',
      groupExpansion: {},
      sessionOrderByAccount: {},
      archivedFilter: 'default',
    }),
    persist: 'dsh.workspace.view.v5',
    actions: {
      setGroupBy: (d, mode: SessionGroupBy) => { d.groupBy = mode },
      setOrderBy: (d, mode: SessionOrderBy, initialOrders) => {
        if (mode === d.orderBy) return
        d.sessionOrderByAccount = mode === 'manual' ? copySessionOrders(initialOrders) : {}
        d.orderBy = mode
      },
      setGroupExpanded: (d, key: string, expanded: boolean) => { d.groupExpansion[key] = expanded },
      retainAccountKeys: (d, workspaceKeys: readonly string[]) => {
        const retained = new Set(workspaceKeys)
        d.groupExpansion = Object.fromEntries(
          Object.entries(d.groupExpansion).filter(([key]) => retained.has(key)),
        )
        d.sessionOrderByAccount = Object.fromEntries(
          Object.entries(d.sessionOrderByAccount).filter(([key]) => retained.has(key)),
        )
        delete (d as WorkspaceViewState & { sessionUpdatedAtByAccount?: unknown }).sessionUpdatedAtByAccount
      },
      syncSessionOrders: (d, orders) => {
        if (d.orderBy !== 'manual') return
        Object.assign(d.sessionOrderByAccount, copySessionOrders(orders))
      },
      setSessionOrder: (d, accountKey, order, initialOrders) => {
        if (d.orderBy === 'updated') d.sessionOrderByAccount = copySessionOrders(initialOrders)
        else Object.assign(d.sessionOrderByAccount, copySessionOrders(initialOrders))
        d.orderBy = 'manual'
        d.sessionOrderByAccount[accountKey] = [...order]
      },
      pinSessionOrder: (d, sessionId, accountKeys, source) => {
        const selected = new Set(accountKeys)
        d.sessionOrderByAccount = Object.fromEntries(Object.entries(source.members).map(([key, members]) => {
          const order = reconcileManualOrder(members, d.sessionOrderByAccount[key], source.summaries, source.rowState)
          return [key, selected.has(key) ? [sessionId, ...order.filter(id => id !== sessionId)] : order]
        }))
      },
      setArchivedFilter: (d, filter: ArchivedFilter) => { d.archivedFilter = filter },
      setZoneExpanded: (d, zoneKey: string, expanded: boolean) => {
        // The workspace/quick-qa/secure zones are mutually exclusive: opening
        // one folds the other two so the sidebar shows at most one body.
        if (expanded) {
          d.zoneExpansion = { workspace: false, 'quick-qa': false, secure: false, [zoneKey]: true }
        } else {
          d.zoneExpansion = { ...d.zoneExpansion, [zoneKey]: false }
        }
      },
      setZoneListView: (d, zoneKey: SidebarZoneKey, view: Partial<ZoneListViewState>) => {
        const current = d.zoneListView?.[zoneKey] ?? { orderBy: 'updated' as SessionOrderBy, archivedFilter: 'default' as ArchivedFilter, query: '' }
        d.zoneListView = { ...d.zoneListView, [zoneKey]: { ...current, ...view } }
      },
    },
  })
}

/** The bound write set of one viewing-store instance (what the UiWorkspace service drives). */
export type WorkspaceViewStoreActions = ReturnType<ReturnType<typeof createWorkspaceViewStore>['create']>['actions']
/** One viewing-store instance's read side: the live snapshot source the UiWorkspace service re-publishes per zone. */
export type WorkspaceViewStoreInstance = ReturnType<ReturnType<typeof createWorkspaceViewStore>['create']>
