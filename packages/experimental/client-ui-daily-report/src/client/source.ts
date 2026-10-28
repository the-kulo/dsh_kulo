import type { RemoteResult } from '@deepseek-ai/dsh-api-remotes/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { DailyReport } from '@deepseek-ai/dsh-experimental-daily-report/types'

/** Current history and generation state exposed to the daily-report panel. */
export interface DailyReportSnapshot {
  /** Reports from the latest successful refresh, retained during loading and refresh failures. */
  readonly records: readonly DailyReport[]
  /** Whether report history is loading, ready, or failed to refresh. */
  readonly status: 'loading' | 'ready' | 'error'
  /** Whether a manual generation request is running. */
  readonly generating: boolean
}

/** State and actions supplied to the daily-report panel. */
export interface DailyReportInjected {
  readonly hooks: {
    /** Report snapshot observable whose first subscriber starts loading and reset handling. */
    readonly reports: HostObservable<DailyReportSnapshot>
  }
  /**
   * Run manual generation and then refresh report history.
   * @returns A promise that resolves after generation and the subsequent refresh settle.
   */
  readonly generate: () => Promise<void>
  /**
   * Open a source Session in the workspace.
   * @param id - Identifier of the source Session.
   * @returns Nothing.
   */
  readonly openSession: (id: DailyReport['sources'][number]['sessionId']) => void
}

/**
 * Create a Remote history source that loads on first subscription, refreshes on reset, and ignores superseded reads.
 * @param list - Remote call that reads durable report history.
 * @param run - Remote call that generates one report.
 * @param subscribeReset - Registers a refresh listener and returns its disposer.
 * @returns Report state and generation action; the caller supplies source-Session navigation.
 */
export function createDailyReportSource(
  list: () => Promise<RemoteResult<DailyReport[]>>,
  run: () => Promise<RemoteResult<DailyReport>>,
  subscribeReset: (listener: () => void) => () => void,
): Omit<DailyReportInjected, 'openSession'> {
  let snapshot: DailyReportSnapshot = { records: [], status: 'loading', generating: false }
  const listeners = new Set<() => void>()
  let epoch = 0
  let reset: (() => void) | undefined
  const publish = (next: DailyReportSnapshot): void => {
    snapshot = next
    for (const listener of listeners) listener()
  }
  const refresh = async (): Promise<void> => {
    const current = ++epoch
    publish({ ...snapshot, status: 'loading' })
    try {
      const result = await list()
      if (current !== epoch) return
      publish(result.ok
        ? { ...snapshot, records: result.value, status: 'ready' }
        : { ...snapshot, status: 'error' })
    } catch (_error: unknown) {
      if (current === epoch) publish({ ...snapshot, status: 'error' })
    }
  }
  return {
    hooks: { reports: {
      getSnapshot: () => snapshot,
      subscribe(listener) {
        listeners.add(listener)
        if (listeners.size === 1) {
          reset = subscribeReset(() => { void refresh() })
          void refresh()
        }
        return () => {
          listeners.delete(listener)
          if (listeners.size === 0) {
            reset?.()
            reset = undefined
            epoch++
          }
        }
      },
    } },
    generate: async () => {
      publish({ ...snapshot, generating: true })
      try { await run() } catch (_error: unknown) { /* refresh exposes durable failure attempts */ }
      publish({ ...snapshot, generating: false })
      await refresh()
    },
  }
}
