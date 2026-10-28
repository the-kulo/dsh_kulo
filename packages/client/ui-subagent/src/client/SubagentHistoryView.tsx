/**
 * Subagent history view tab: the durable descendant catalog projected from
 * the Session store, rendered one tab beside Chat and Trajectory. The view
 * is read-only history (the header catalog action owns the interactive
 * navigation); an empty catalog shows one localized empty state.
 */
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SnapshotSelectorHook, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { NS } from './locales.ts'
import css from './SubagentHistoryView.module.css'

/** Full props of the Subagent history view tab. */
export interface SubagentHistoryViewProps {
  readonly sessionId: SessionId
  readonly useSessions: SnapshotSelectorHook<SessionListState>
  readonly useSessionStatus: SnapshotSelectorHook<SessionStatusSnapshot>
  readonly t: TranslateNS<typeof NS>
}

/** Render the subagent catalog as a read-only history list. */
export function SubagentHistoryView({ sessionId, useSessions, useSessionStatus, t }: SubagentHistoryViewProps) {
  const projections = useSessions(state => state.projectionsBySession)
  const summaries = useSessions(state => state.byId)
  const statuses = useSessionStatus(value => value)
  const catalog = projections[sessionId]?.values.subagentCatalog
  const listing = useSessions(state => state.phase === 'pending')

  if (catalog === undefined || (listing && catalog.length === 0)) {
    return (
      <div className={css.notice} role="status">
        <StateDot state={listing ? 'ongoing' : 'warning'} />
        {t(listing ? 'history.loading' : 'history.unavailable')}
      </div>
    )
  }
  if (catalog.length === 0) {
    return (
      <div className={css.notice} role="status">
        <StateDot state="idle" />
        {t('history.empty')}
      </div>
    )
  }
  return (
    <ul className={css.list} data-subagent-history="">
      {catalog.map((entry) => {
        const running = (statuses.get(entry.id)?.running ?? summaries[entry.id]?.running) === true
        const mode = entry.mode === 'external' ? t('mode.external')
          : entry.mode === 'unknown' ? t('mode.unknown')
            : entry.mode === 'one-shot' ? t('mode.oneShot') : t('mode.continuable')
        return (
          <li key={entry.id} className={css.row}>
            <StateDot state={running ? 'ongoing' : 'idle'} />
            <span className={css.label}>{entry.label ?? entry.id}</span>
            <span className={css.meta}>{mode}</span>
          </li>
        )
      })}
    </ul>
  )
}
