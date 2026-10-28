/**
 * Agent-team history view tab: the durable roster and task board projected
 * from the Lead Session's `agentTeam` projection, rendered one tab beside
 * Chat and Trajectory. With no team record it shows one localized empty
 * state.
 */
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-experimental-agent-team/client'
import { NS, type TeamKey } from './locales.ts'
import css from './TeamAction.module.css'

/** Full props of the Agent-team history view tab. */
export type TeamHistoryViewProps = Pick<PropsRuntime<'conversation.view'>,
  'sessionId' | 'useSession' | 'useSessions' | 'useSessionStatus'> & PropsLocale<typeof NS>

function statusText(status: 'pending' | 'in_progress' | 'completed' | 'deleted', t: TranslateNS<typeof NS>): string {
  switch (status) {
    case 'pending': return t('status.pending')
    case 'in_progress': return t('status.in_progress')
    case 'completed': return t('status.completed')
    /* v8 ignore next -- the projection drops deleted task tombstones. */
    case 'deleted': return t('status.completed')
  }
}

function memberPhaseKey(phase: 'provisioning' | 'active' | 'failed'): TeamKey {
  switch (phase) {
    case 'active': return 'memberStatus.inactive'
    case 'provisioning': return 'memberStatus.provisioning'
    case 'failed': return 'memberStatus.failed'
  }
}

/** Render the Agent-team roster and task board as a read-only history view. */
export function TeamHistoryView({ sessionId, useSession, useSessions, useSessionStatus, t }: TeamHistoryViewProps) {
  void useSessionStatus // the tab reads durable history; live turn status stays the panel's concern
  const leadSessionId = useSession(snapshot => snapshot.subagent?.address.parentSessionId) ?? sessionId
  const team = useSessions(state => state.projectionsBySession[leadSessionId]?.values.agentTeam)
  const opening = useSession(snapshot => snapshot.openState === 'loading')
  const listing = useSessions(state => state.phase === 'pending')

  if (team === undefined) {
    return (
      <div className={css.notice} role="status">
        <StateDot state={opening || listing ? 'ongoing' : 'warning'} />
        {t(opening || listing ? 'loading' : 'unavailable')}
      </div>
    )
  }
  return (
    <div className={css.body} data-agent-team-history="">
      {team.failure !== undefined && (
        <div className={css.error} role="alert">{t('failure', { message: team.failure })}</div>
      )}
      <section>
        <h3>
          {t('roster')}
          {team.members.length > 1 && <span className={css.count}>{team.members.length}</span>}
        </h3>
        <div className={css.roster}>
          {team.members.map(member => (
            <article key={member.id} className={css.member} aria-disabled="true">
              <span className={css.memberDot}>
                <StateDot state={member.phase === 'active' ? 'done' : member.phase === 'failed' ? 'error' : 'ongoing'} />
              </span>
              <span className={css.memberText}>
                <span className={css.memberName}><span className={css.memberNameText}>{member.name}</span></span>
                <small>{t(memberPhaseKey(member.phase))}</small>
                {member.error !== undefined && <small className={css.diagnostic}>{member.error}</small>}
              </span>
            </article>
          ))}
        </div>
      </section>
      <section>
        {team.tasks.length === 0
          ? <p className={css.emptyNotice}>{t('empty')}</p>
          : (
            <>
              <h3>{t('tasks')}<span className={css.count}>{team.tasks.length}</span></h3>
              <div className={css.tasks}>
                {team.tasks.map(task => (
                  <article key={task.id} className={css.task}>
                    <div className={css.taskTitle}>
                      <strong>{task.subject}</strong>
                      <span className={css.taskState}>
                        <StateDot state={task.status === 'completed' ? 'done' : task.status === 'in_progress' ? 'ongoing' : task.ready ? 'idle' : 'warning'} />
                        <span>{statusText(task.status, t)}</span>
                      </span>
                    </div>
                    <p>{task.description}</p>
                    <div className={css.meta}>
                      <span>{task.id}</span>
                      <span>{t('owner')}: {task.ownerName ?? t('unowned')}</span>
                      {task.blockedBy.length > 0 && <span>{t('blockedBy')}: {task.blockedBy.join(', ')}</span>}
                      {task.writeScopes.length > 0 && <span>{t('writeScopes')}: {task.writeScopes.join(', ')}</span>}
                      {task.writeScopeWarnings.map(warning => <span key={warning} className={css.warning}>{warning}</span>)}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
      </section>
    </div>
  )
}
