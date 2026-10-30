/**
 * The quick-qa zone body: a compact search bar over the zone's conversation
 * list. The rows and the search control mirror the Workspace browser's
 * FlatList/SearchResults presentation (same 32px session cell, trailing
 * relative time, inline expanding search) without the Workspace grouping,
 * folders, or drag affordances — quick-answer Sessions never join a
 * Workspace. The zone accordion (ui-workspace's AccordionSection) owns the
 * collapse chevron and the New conversation button; this panel renders only
 * the independently scrolling history.
 */

import { memo, useState } from 'react'
import clsx from 'clsx'
import {
  IconCloseFillRegular, IconSearchOutlineRegular, relativeTime, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { QuickQaPanelProps, QuickQaSessionItem } from './contract/slots.ts'
import css from './QuickQaPanel.module.css'

type PanelTranslate = QuickQaPanelProps['t']

/** Localized compact relative time, matching the Workspace browser's trailing row label. */
function timeLabel(updatedAt: number, now: number, t: PanelTranslate): string {
  const { unit, n } = relativeTime(updatedAt, now)
  return unit === 'now' ? t('time.now') : t(`time.${unit}`, { n })
}

/**
 * One conversation row, after the Workspace browser's session cell: a
 * one-line title (blank Sessions show the New Session label) plus the
 * relative update time, opening the Session on click.
 * @param props.item - the zone conversation.
 * @param props.now - epoch ms for relative-time formatting.
 * @param props.onOpen - open the conversation as the current Main Session.
 * @param props.t - the panel's locale seat.
 * @returns the row element.
 */
function SessionRow({ item, now, onOpen, t }: {
  item: QuickQaSessionItem
  now: number
  onOpen: (id: QuickQaSessionItem['id']) => void
  t: PanelTranslate
}) {
  const title = item.blank ? t('session.new') : (item.title || t('session.untitled'))
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
    </div>
  )
}

/**
 * Render the quick-qa zone panel: expanding inline search, the filtered
 * conversation list, and the empty/no-matches states.
 * @param props - composed slot props (store + injected face + locale).
 * @returns the panel element tree.
 */
export const QuickQaPanel = memo(function QuickQaPanel({
  useStore,
  useSessionItems,
  openSession,
  t,
}: QuickQaPanelProps) {
  const failures = useStore(state => state.failures)
  const items = useSessionItems(value => value)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visible = normalizedQuery === ''
    ? items
    : items.filter(item => item.title.toLocaleLowerCase().includes(normalizedQuery))
  const now = Date.now()

  return (
    <section className={css.root} aria-label={t('section.title')}>
      <div className={css.header}>
        <div
          className={clsx(css.search, searchExpanded && css.searchExpanded)}
          onClick={() => { setSearchExpanded(true) }}
        >
          <Tooltip label={t('search.aria')} side="bottom" delayMs={500} disabled={searchExpanded}>
            <button
              type="button"
              className={css.searchButton}
              aria-label={t('search.aria')}
              aria-expanded={searchExpanded}
              onClick={() => { setSearchExpanded(true) }}
            >
              <IconSearchOutlineRegular size={searchExpanded ? 11 : 14} />
            </button>
          </Tooltip>
          <input
            className={css.searchInput}
            type="text"
            placeholder={t('search.placeholder')}
            value={query}
            tabIndex={searchExpanded ? 0 : -1}
            onChange={(e) => { setQuery(e.target.value) }}
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return
              setQuery('')
              setSearchExpanded(false)
            }}
          />
          {searchExpanded && (
            <button
              type="button"
              className={css.clearButton}
              aria-label={t('search.clear')}
              onClick={(e) => {
                e.stopPropagation()
                setQuery('')
                setSearchExpanded(false)
              }}
            >
              <IconCloseFillRegular />
            </button>
          )}
        </div>
      </div>
      <div className={css.list} aria-live="polite">
        <div role="tree" aria-label={t('section.title')}>
          {visible.map(item => (
            <SessionRow key={item.id} item={item} now={now} onOpen={openSession} t={t} />
          ))}
          {visible.length === 0 && (
            <div className={css.empty}>
              {normalizedQuery === '' ? t('empty.none') : t('search.noMatches')}
            </div>
          )}
        </div>
      </div>
      {failures.length > 0 && <p className={css.error} role="alert">{failures.join(' ')}</p>}
    </section>
  )
})
