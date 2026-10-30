/**
 * Secure-zone conversation region: an inline expanding search header and the
 * zone's Session list, mirroring the Workspace browser's search control and
 * 32px session rows (title + trailing relative time, Enter/Space opens, a
 * blank row at the top mirrors the Workspace blank Session). The zone knows
 * no Workspaces: rows are title-filtered locally, a non-blank query also
 * searches message content on the Host and intersects the hits with the
 * zone's own ids, and the New conversation button stays in the zone
 * accordion header owned by ui-workspace.
 */

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { IconCloseFillRegular, IconSearchOutlineRegular, relativeTime } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionSearchResultItem } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SecureZonePanelProps } from './contract/slots.ts'
import type { SecureZoneSessionItem } from './contract/slots.ts'
import css from './SecureZonePanel.module.css'

/** Pause between the latest keystroke and a Host content-search request. */
const SEARCH_DEBOUNCE_MS = 250
/** `session.search` wire bound, measured in JavaScript UTF-16 code units. */
const SEARCH_QUERY_MAX_CODE_UNITS = 500

/** Keep the controlled input and the RPC payload inside the session.search wire contract. */
function sanitizeSearchQuery(value: string): string {
  const withoutNul = value.replaceAll('\0', '')
  if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul
  let end = SEARCH_QUERY_MAX_CODE_UNITS
  const last = withoutNul.charCodeAt(end - 1)
  const next = withoutNul.charCodeAt(end)
  if (last >= 0xD800 && last <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF) end--
  return withoutNul.slice(0, end)
}

/** Row display title: the blank row shows the localized New Session label. */
function displayTitle(item: SecureZoneSessionItem, t: SecureZonePanelProps['t']): string {
  return item.blank ? t('session.new') : (item.title || t('session.untitled'))
}

/** Localized compact relative time ("刚刚"/"5分钟" in zh, "now"/"5min" in en). */
function timeLabel(updatedAt: number, now: number, t: SecureZonePanelProps['t']): string {
  const { unit, n } = relativeTime(updatedAt, now)
  return unit === 'now' ? t('time.now') : t(`time.${unit}`, { n })
}

/** One 32px session row: title, trailing relative time, selected marker. */
function SessionRow({
  item, now, onOpen, t,
}: {
  item: SecureZoneSessionItem
  now: number
  onOpen: (id: SessionId) => void
  t: SecureZonePanelProps['t']
}) {
  const title = displayTitle(item, t)
  return (
    <div
      className={clsx(css.sessionRow, item.current && css.selected)}
      role="treeitem"
      aria-selected={item.current}
      tabIndex={0}
      onClick={() => { onOpen(item.id) }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
        event.preventDefault()
        onOpen(item.id)
      }}
    >
      <span className={css.title}>{title}</span>
      {!item.blank && <span className={css.time}>{timeLabel(item.updatedAt, now, t)}</span>}
    </div>
  )
}

/** One content-search hit: zone session title plus the matched excerpt. */
function SearchResultRow({
  item, snippet, now, onOpen, t,
}: {
  item: SecureZoneSessionItem
  snippet: string | undefined
  now: number
  onOpen: (id: SessionId) => void
  t: SecureZonePanelProps['t']
}) {
  const title = displayTitle(item, t)
  return (
    <div
      className={clsx(css.searchResultRow, item.current && css.selected)}
      role="treeitem"
      aria-selected={item.current}
      tabIndex={0}
      onClick={() => { onOpen(item.id) }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
        event.preventDefault()
        onOpen(item.id)
      }}
    >
      <span className={css.searchResultHeading}>
        <span className={css.searchResultTitle}>{title}</span>
        <span className={css.time}>{timeLabel(item.updatedAt, now, t)}</span>
      </span>
      {snippet !== undefined && <span className={css.searchResultSnippet}>{snippet}</span>}
    </div>
  )
}

/** In-flight Host content-search page for the current query. */
interface RemoteSearchState {
  query: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: readonly SessionSearchResultItem[]
  hasMore: boolean
}

/**
 * Render the zone panel.
 * @param props - composed slot props (store + injected face + locale seat).
 * @returns the region element tree.
 */
export const SecureZonePanel = memo(function SecureZonePanel({
  useStore,
  actions,
  useSessionItems,
  openSession,
  searchSessions,
  searchResultLimit,
  t,
}: SecureZonePanelProps) {
  const failures = useStore(state => state.failures)
  const items = useSessionItems(value => value)
  // The query outlives the search chrome (and a zone collapse) through the
  // persisted store, like the Workspace browser's own list state.
  const query = useStore(state => state.query)
  const setQuery = actions.setQuery
  const [searchExpanded, setSearchExpanded] = useState(query !== '')
  const normalizedQuery = query.trim()
  const [remoteSearch, setRemoteSearch] = useState<RemoteSearchState>({
    query: '',
    status: 'idle',
    items: [],
    hasMore: false,
  })
  const searchRoot = useRef<HTMLDivElement | null>(null)
  const searchInput = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (normalizedQuery === '') {
      setRemoteSearch({ query: '', status: 'idle', items: [], hasMore: false })
      return
    }
    const controller = new AbortController()
    setRemoteSearch({ query: normalizedQuery, status: 'loading', items: [], hasMore: false })
    const timer = window.setTimeout(() => {
      searchSessions(normalizedQuery, controller.signal).then((result) => {
        if (controller.signal.aborted) return
        setRemoteSearch({ query: normalizedQuery, status: 'ready', items: result.items, hasMore: result.hasMore })
      }).catch(() => {
        if (controller.signal.aborted) return
        setRemoteSearch({ query: normalizedQuery, status: 'error', items: [], hasMore: false })
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [normalizedQuery, searchSessions])

  // Outside-click dismissal collapses the chrome but keeps a non-empty query,
  // so the filter survives until the user clears it.
  useEffect(() => {
    if (!searchExpanded) return
    const onClick = (event: MouseEvent): void => {
      if (!(event.target instanceof Node) || searchRoot.current?.contains(event.target) === true) return
      searchInput.current?.blur()
      if (normalizedQuery !== '') return
      setSearchExpanded(false)
    }
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('click', onClick) }
  }, [normalizedQuery, searchExpanded])

  const zoneIds = useMemo(() => new Set(items.map(item => item.id)), [items])
  const titleMatches = useMemo(() => normalizedQuery === ''
    ? items
    : items.filter(item => displayTitle(item, t).toLocaleLowerCase().includes(normalizedQuery.toLocaleLowerCase())),
  [items, normalizedQuery, t])
  const currentRemote = remoteSearch.query === normalizedQuery
    ? remoteSearch
    : { query: normalizedQuery, status: 'loading' as const, items: [], hasMore: false }
  const contentHits = useMemo(() => {
    const snippets = new Map<string, string>()
    for (const hit of currentRemote.items) {
      if (!zoneIds.has(hit.sessionId) || snippets.has(hit.sessionId)) continue
      snippets.set(hit.sessionId, hit.snippet)
    }
    return snippets
  }, [currentRemote.items, zoneIds])
  const contentOnly = useMemo(() => items.filter(
    item => contentHits.has(item.id)
      && !displayTitle(item, t).toLocaleLowerCase().includes(normalizedQuery.toLocaleLowerCase()),
  ), [items, contentHits, normalizedQuery, t])
  const searchPending = normalizedQuery !== '' && currentRemote.status === 'loading'
  const hasMore = normalizedQuery !== '' && currentRemote.status === 'ready' && currentRemote.hasMore
  const now = Date.now()

  const listBody = normalizedQuery === ''
    ? (
      <div className={css.list} role="tree" aria-label={t('section.title')}>
        {items.length === 0 && <div className={css.empty}>{t('empty.none')}</div>}
        {items.map(item => <SessionRow key={item.id} item={item} now={now} onOpen={openSession} t={t} />)}
      </div>
    )
    : (
      <div className={css.list} role="tree" aria-label={t('search.results.aria')}>
        {titleMatches.map(item => <SessionRow key={item.id} item={item} now={now} onOpen={openSession} t={t} />)}
        {contentOnly.map(item => (
          <SearchResultRow key={item.id} item={item} snippet={contentHits.get(item.id)} now={now} onOpen={openSession} t={t} />
        ))}
        {searchPending && (
          <div role="status" aria-label={t('search.pending')}>
            {[0, 1].map(i => (
              <div key={i} className={css.skeletonRow} aria-hidden="true">
                <span className={css.skeletonDot} />
                <span className={css.skeletonBars}>
                  <span className={css.skeletonBar} />
                  <span className={clsx(css.skeletonBar, css.skeletonBarWide)} />
                </span>
              </div>
            ))}
          </div>
        )}
        {!searchPending && titleMatches.length === 0 && contentOnly.length === 0 && (
          <div className={css.empty}>{t('search.noMatches')}</div>
        )}
        {hasMore && <div className={css.searchStatus}>{t('search.hasMore', { n: searchResultLimit })}</div>}
      </div>
    )

  return (
    <section className={css.root} aria-label={t('section.title')}>
      <div className={css.sectionHeader}>
        <div
          ref={searchRoot}
          className={clsx(css.search, searchExpanded && css.searchExpanded)}
          onClick={() => {
            setSearchExpanded(true)
            searchInput.current?.focus()
          }}
        >
          <button
            type="button"
            className={css.searchButton}
            aria-label={t('search.aria')}
            aria-expanded={searchExpanded}
            title={t('search')}
            onClick={() => {
              setSearchExpanded(true)
              searchInput.current?.focus()
            }}
          >
            <IconSearchOutlineRegular size={searchExpanded ? 11 : 14} />
          </button>
          <input
            ref={searchInput}
            className={css.searchInput}
            type="text"
            placeholder={t('search.placeholder')}
            maxLength={SEARCH_QUERY_MAX_CODE_UNITS}
            value={query}
            tabIndex={searchExpanded ? 0 : -1}
            onChange={(e) => { setQuery(sanitizeSearchQuery(e.target.value)) }}
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
      <div className={css.history} aria-live="polite">
        {listBody}
      </div>
      {failures.length > 0 && <p className={css.error} role="alert">{failures.join(' ')}</p>}
    </section>
  )
})
