/**
 * Discussion-room history view tab: the durable room record folded from the
 * `plugin:discussion-room/state` durable plugin record, rendered one tab
 * beside Chat and Trajectory. The view is read-only history; with no room it
 * shows one localized empty state.
 */
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  DiscussionMessage, DiscussionRoom, DiscussionRoomStatus,
} from '@deepseek-ai/dsh-experimental-discussion-room/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { NS, type DiscussionKey } from './locales.ts'
import css from './DiscussionAction.module.css'

/** Full props of the discussion-room history view tab. */
export interface DiscussionHistoryViewProps {
  readonly sessionId: import('@deepseek-ai/dsh-session/types').SessionId
  readonly useProjection: import('@deepseek-ai/dsh-api-session-controller/client').UseProjection
  readonly t: TranslateNS<typeof NS>
}

const STATUS_KEYS: Readonly<Record<DiscussionRoomStatus, DiscussionKey>> = {
  running: 'statusRunning', stopping: 'statusStopping', completed: 'statusCompleted',
  failed: 'statusFailed', stopped: 'statusStopped',
}

function messageDot(message: DiscussionMessage): StateDotState {
  if (message.status === 'running') return 'ongoing'
  return message.status === 'completed' ? 'done' : 'error'
}

function roomDot(status: DiscussionRoomStatus): StateDotState {
  if (status === 'running' || status === 'stopping') return 'ongoing'
  if (status === 'completed') return 'done'
  if (status === 'failed') return 'error'
  return 'idle'
}

/** Render one durable discussion room as a read-only history view. */
export function DiscussionHistoryView({ useProjection, t }: DiscussionHistoryViewProps) {
  const projection = useProjection('discussionRoom')
  const room = projection?.room ?? null

  if (room === null) {
    return (
      <div className={css.notice} role={projection?.failure === undefined ? 'status' : 'alert'}>
        <StateDot state={projection?.failure !== undefined ? 'error' : 'idle'} />
        {projection?.failure !== undefined
          ? t('projectionFailure', { message: projection.failure })
          : t('tab.empty')}
      </div>
    )
  }
  return <DiscussionRoomContent room={room} t={t} history />
}

/** Render one room's durable configuration and contributions for both the dialog and history tab. */
export function DiscussionRoomContent({ room, t, history = false }: {
  readonly room: DiscussionRoom
  readonly t: TranslateNS<typeof NS>
  readonly history?: boolean
}) {
  return (
    <div className={css.room} {...history ? { 'data-discussion-room-history': '' } : {}}>
      <section className={css.summary}>
        <h3>{room.topic}</h3>
        <div className={css.status}><StateDot state={roomDot(room.status)} /><span>{t(STATUS_KEYS[room.status])}</span>
          <span>{t('roundProgress', { current: room.currentRound, total: room.roundLimit })}</span></div>
        {room.failure !== undefined && <p role="alert" className={css.error}>{room.failure}</p>}
      </section>
      <section className={css.section}>
        <h3>{t('participants')}</h3>
        <ul className={css.roster}>
          {room.participants.map(participant => <li key={participant.id}>
            <strong>{participant.name}</strong><span>{participant.provider}/{participant.model}</span><small>{participant.role}</small>
          </li>)}
          <li><strong>{room.moderator.name}</strong><span>{room.moderator.provider}/{room.moderator.model}</span><small>{t('moderatorBadge')}</small></li>
        </ul>
      </section>
      <section className={css.section}>
        <h3>{t('messages')}</h3>
        {room.messages.length === 0 && <p className={css.notice}>{t('emptyMessages')}</p>}
        <div className={css.messages}>
          {room.messages.map(message => <article className={css.message} key={message.id} data-kind={message.kind}>
            <header><strong>{message.participantName}</strong><span>{t(message.kind === 'opinion' ? 'kindOpinion' : message.kind === 'rebuttal' ? 'kindRebuttal' : 'kindSummary', { round: message.round })}</span>
              <span className={css.messageStatus}><StateDot state={messageDot(message)} />{t(message.status === 'running' ? 'messageRunning' : message.status === 'failed' ? 'messageFailed' : 'statusCompleted')}</span></header>
            {message.text !== undefined && <p className={css.messageText}>{message.text}</p>}
            {message.error !== undefined && <p role="alert" className={css.error}>{message.error}</p>}
          </article>)}
        </div>
      </section>
    </div>
  )
}
