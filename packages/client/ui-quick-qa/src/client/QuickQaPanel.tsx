/**
 * The quick-qa zone body: the conversation list. The header chrome (search,
 * view options, New conversation) lives in the accordion header owned by
 * ui-workspace; this panel renders only the scrollable list, filtered by the
 * query the header search writes into the persisted zone view state.
 */

import { memo, useEffect, useRef, useState } from 'react'
import {
  Button, Modal, relativeTime,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { QuickQaPanelProps, QuickQaSessionItem } from './contract/slots.ts'
import { QuickQaSessionMenu } from './session-actions/QuickQaSessionMenu.tsx'
import css from './QuickQaPanel.module.css'

type PanelTranslate = QuickQaPanelProps['t']

/** Localized compact relative time, matching the Workspace browser's trailing row label. */
function timeLabel(updatedAt: number, now: number, t: PanelTranslate): string {
  const { unit, n } = relativeTime(updatedAt, now)
  return unit === 'now' ? t('time.now') : t(`time.${unit}`, { n })
}

/** Row display title: blank rows show the localized New Session label. */
function displayTitle(item: QuickQaSessionItem, t: PanelTranslate): string {
  return item.blank ? t('session.new') : (item.title || t('session.untitled'))
}

/**
 * One conversation row, after the Workspace browser's session cell: a
 * one-line title (blank Sessions show the New Session label) plus the
 * relative update time, opening the Session on click. A non-blank row also
 * carries the hover "…" action menu.
 * @param props.item - the zone conversation.
 * @param props.now - epoch ms for relative-time formatting.
 * @param props.onOpen - open the conversation as the current Main Session.
 * @param props.onRenameRequest - ask the panel rename dialog to open.
 * @param props.onDeleteRequest - ask the panel delete confirmation to open.
 * @param props.actions - the injected session-management callbacks.
 * @param props.t - the panel's locale seat.
 * @returns the row element.
 */
function SessionRow({ item, now, onOpen, onRenameRequest, onDeleteRequest, actions, t }: {
  item: QuickQaSessionItem
  now: number
  onOpen: (id: SessionId) => void
  onRenameRequest: (sessionId: SessionId, currentTitle: string) => void
  onDeleteRequest: (sessionId: SessionId, displayTitle: string) => void
  actions: Pick<
    QuickQaPanelProps,
    'archiveSession' | 'unarchiveSession' | 'pinSession' | 'unpinSession'
  >
  t: PanelTranslate
}) {
  const title = displayTitle(item, t)
  return (
    <div
      className={css.sessionRow}
      role="treeitem"
      aria-selected={false}
      tabIndex={0}
      onClick={() => { onOpen(item.id) }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
        event.preventDefault()
        onOpen(item.id)
      }}
    >
      <span className={css.title} title={title}>{title}</span>
      {!item.blank && item.updatedAt > 0 && (
        <span className={css.time}>{timeLabel(item.updatedAt, now, t)}</span>
      )}
      {!item.blank && (
        <QuickQaSessionMenu
          item={item}
          displayTitle={title}
          archiveSession={actions.archiveSession}
          unarchiveSession={actions.unarchiveSession}
          pinSession={actions.pinSession}
          unpinSession={actions.unpinSession}
          onRenameRequest={onRenameRequest}
          onDeleteRequest={onDeleteRequest}
          t={t}
        />
      )}
    </div>
  )
}

/**
 * Render the quick-qa zone panel: expanding inline search, the filtered
 * conversation list, the empty/no-matches states, and the rename/delete
 * dialog surfaces.
 * @param props - composed slot props (store + injected face + locale).
 * @returns the panel element tree.
 */
export const QuickQaPanel = memo(function QuickQaPanel({
  useStore,
  useSessionItems,
  useListView,
  controllerSetListView,
  openSession,
  renameSession,
  deleteSession,
  archiveSession,
  unarchiveSession,
  pinSession,
  unpinSession,
  t,
}: QuickQaPanelProps) {
  const failures = useStore(state => state.failures)
  const items = useSessionItems(value => value)
  const listView = useListView(value => value)
  // The query lives in the persisted zone view state the accordion header's
  // search writes; the panel reads it back to filter the list locally.
  const query = listView.query
  // The persisted zone view state flows back into the controller so a header
  // view-options pick re-derives the published list.
  useEffect(() => { controllerSetListView(listView) }, [listView, controllerSetListView])
  const [renameTarget, setRenameTarget] = useState<{ sessionId: SessionId; currentTitle: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ sessionId: SessionId; displayTitle: string } | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const composingRef = useRef(false)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visible = normalizedQuery === ''
    ? items
    : items.filter(item => displayTitle(item, t).toLocaleLowerCase().includes(normalizedQuery))
  const now = Date.now()

  const onRenameRequest = (sessionId: SessionId, currentTitle: string): void => {
    setRenameTarget({ sessionId, currentTitle })
    setRenameDraft(currentTitle)
    setRenameError(null)
  }

  const onDeleteRequest = (sessionId: SessionId, displayTitleValue: string): void => {
    setDeleteTarget({ sessionId, displayTitle: displayTitleValue })
    setDeleteError(null)
  }

  const renameTrimmed = renameDraft.trim()
  const renameBlocked = renaming || renameTrimmed === '' || renameTarget === null
  const closeRename = (): void => {
    if (renaming) return
    setRenameTarget(null)
    setRenameError(null)
  }
  const confirmRename = (): void => {
    if (renameBlocked || renameTarget === null) return
    setRenaming(true)
    setRenameError(null)
    renameSession(renameTarget.sessionId, renameTrimmed).then(() => {
      setRenaming(false)
      setRenameTarget(null)
    }).catch((reason: unknown) => {
      setRenaming(false)
      setRenameError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  const closeDelete = (): void => {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteError(null)
  }
  const confirmDelete = (): void => {
    if (deleting || deleteTarget === null) return
    setDeleting(true)
    setDeleteError(null)
    deleteSession(deleteTarget.sessionId).then(() => {
      setDeleting(false)
      setDeleteTarget(null)
    }).catch((reason: unknown) => {
      setDeleting(false)
      setDeleteError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  return (
    <section className={css.root} aria-label={t('section.title')}>
      <div className={css.list} aria-live="polite">
        <div role="tree" aria-label={t('section.title')}>
          {visible.map(item => (
            <SessionRow
              key={item.id}
              item={item}
              now={now}
              onOpen={openSession}
              onRenameRequest={onRenameRequest}
              onDeleteRequest={onDeleteRequest}
              actions={{ archiveSession, unarchiveSession, pinSession, unpinSession }}
              t={t}
            />
          ))}
          {visible.length === 0 && (
            <div className={css.empty}>
              {normalizedQuery === '' ? t('empty.none') : t('search.noMatches')}
            </div>
          )}
        </div>
      </div>
      {failures.length > 0 && <p className={css.error} role="alert">{failures.join(' ')}</p>}

      <Modal
        open={renameTarget !== null}
        onClose={closeRename}
        closeLabel={t('close')}
        title={t('rename.session.title')}
        footer={(
          <>
            <Button variant="outline" disabled={renaming} onClick={closeRename}>{t('cancel')}</Button>
            <Button variant="primary" disabled={renameBlocked} onClick={confirmRename}>{t('rename')}</Button>
          </>
        )}
      >
        <input
          className={css.renameInput}
          value={renameDraft}
          aria-label={t('field.sessionName')}
          data-modal-autofocus
          disabled={renaming}
          onFocus={(event) => { event.target.select() }}
          onChange={(event) => { setRenameDraft(event.target.value); setRenameError(null) }}
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={() => { composingRef.current = false }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !composingRef.current) {
              event.preventDefault()
              confirmRename()
            }
          }}
        />
        {renameError !== null && <div className={css.renameError} role="alert">{renameError}</div>}
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={closeDelete}
        closeLabel={t('close')}
        title={t('delete.confirm.title')}
        {...deleteTarget === null
          ? {}
          : { description: t('delete.confirm.desc', { title: deleteTarget.displayTitle }) }}
        footer={(
          <>
            <Button variant="outline" disabled={deleting} onClick={closeDelete}>{t('cancel')}</Button>
            <Button
              variant="outline"
              className={css.deleteAction}
              disabled={deleting}
              onClick={confirmDelete}
            >
              {t('delete.confirm.action')}
            </Button>
          </>
        )}
      >
        {deleting && <div className={css.deleteStatus} role="status">{t('delete.confirm.pending')}</div>}
        {deleteError !== null && <div className={css.renameError} role="alert">{deleteError}</div>}
      </Modal>
    </section>
  )
})
