/**
 * Sidebar zone-chrome controls shared by the Workspace browser's sibling
 * zones (workspace, quick answers, secure zone): an inline expanding search
 * pill, a view-options menu, and a trailing icon button. All copy arrives as
 * complete labels — the controls own no fallback text.
 */

import { type ReactNode, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  IconArchiveCheckOutlineRegular, IconArchiveOffOutlineRegular, IconChevronsUpDownOutlineRegular,
  IconClockOutlineRegular, IconCloseFillRegular, IconFlatListOutlineRegular, IconFolderCloseRegular,
  IconProjectAddOutlineRegular, IconQueueOutlineRegular, IconSearchOutlineRegular,
  IconSlidersTwoOutlineRegular, IconWorkspaceTreeOutlineRegular,
} from './icons/index.tsx'
import { Menu } from './Menu.tsx'
import type { MenuEntry, MenuItem } from './Menu.tsx'
import { Tooltip } from './Tooltip.tsx'
import css from './ZoneChrome.module.css'

/** `session.search` wire bound, measured in JavaScript UTF-16 code units. */
export const ZONE_SEARCH_QUERY_MAX_CODE_UNITS = 500

/** Keep a controlled input and the search payload inside the wire contract. */
export function sanitizeZoneSearchQuery(value: string): string {
  const withoutNul = value.replaceAll('\0', '')
  if (withoutNul.length <= ZONE_SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul
  let end = ZONE_SEARCH_QUERY_MAX_CODE_UNITS
  const last = withoutNul.charCodeAt(end - 1)
  const next = withoutNul.charCodeAt(end)
  if (last >= 0xD800 && last <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF) end--
  return withoutNul.slice(0, end)
}

/** Localized search labels; the owning feature's locale dictionary supplies them. */
export interface ZoneSearchLabels {
  /** Collapsed icon button's accessible name (for example "Search sessions"). */
  readonly aria: string
  /** Expanded input placeholder. */
  readonly placeholder: string
  /** Clear button's accessible name. */
  readonly clear: string
}

/**
 * The shared inline search control: a bare icon button that grows into a
 * bordered pill over the sibling action cluster. The owner drives expansion
 * so an open search can hide its neighbors; Escape or Clear resets and
 * collapses.
 * @param props.expanded - whether the input is visible.
 * @param props.query - current draft (already sanitized through `onQueryChange`).
 * @param props.labels - localized search labels.
 * @param props.tooltip - optional collapsed-button tooltip text; omitted for header seats.
 * @param props.stopPropagation - stop click/key propagation to the accordion header so using search does not fold the zone.
 * @param props.onExpandedChange - expansion request from the icon button or the pill frame.
 * @param props.onQueryChange - sanitized draft change.
 * @param props.onClear - draft cleared and collapsed.
 * @returns the search element.
 */
export function ZoneSearch({ expanded, query, labels, tooltip, stopPropagation = false, onExpandedChange, onQueryChange, onClear }: {
  expanded: boolean
  query: string
  labels: ZoneSearchLabels
  tooltip?: string
  /** Stop click/keydown propagation (accordion header seats); panel bodies leave it off. */
  stopPropagation?: boolean
  onExpandedChange: (expanded: boolean) => void
  onQueryChange: (query: string) => void
  onClear: () => void
}): ReactNode {
  const input = useRef<HTMLInputElement | null>(null)
  const expand = (): void => {
    onExpandedChange(true)
    input.current?.focus()
  }
  const button = (
    <button
      type="button"
      className={css.searchButton}
      aria-label={labels.aria}
      aria-expanded={expanded}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation()
        expand()
      }}
    >
      <IconSearchOutlineRegular size={expanded ? 11 : 14} />
    </button>
  )
  return (
    <div
      className={clsx(css.search, expanded && css.searchExpanded)}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation()
        if (!expanded) expand()
      }}
      onKeyDown={stopPropagation ? (e) => { e.stopPropagation() } : undefined}
    >
      {tooltip === undefined || expanded
        ? button
        : <Tooltip label={tooltip} side="bottom" delayMs={500}>{button}</Tooltip>}
      <input
        ref={input}
        className={css.searchInput}
        type="text"
        placeholder={labels.placeholder}
        maxLength={ZONE_SEARCH_QUERY_MAX_CODE_UNITS}
        value={query}
        tabIndex={expanded ? 0 : -1}
        onChange={(e) => { onQueryChange(sanitizeZoneSearchQuery(e.target.value)) }}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          onClear()
        }}
      />
      {expanded && (
        <button
          type="button"
          className={css.clearButton}
          aria-label={labels.clear}
          onClick={(e) => {
            e.stopPropagation()
            onClear()
          }}
        >
          <IconCloseFillRegular />
        </button>
      )}
    </div>
  )
}

/** Session order choices shared by the zone view options. */
export type ZoneSessionOrderBy = 'manual' | 'updated'
/** Session grouping choices; only the Workspace zone groups by Workspace. */
export type ZoneSessionGroupBy = 'workspace' | 'workspace-tree' | 'flat'
/** Archived-row visibility shared by the zone view options. */
export type ZoneArchivedFilter = 'default' | 'show' | 'only'

/** Localized view-options labels; the owning feature's locale dictionary supplies them. */
export interface ZoneViewOptionsLabels {
  /** Menu anchor tooltip and accessible name. */
  readonly label: string
  readonly groupByLabel: string
  readonly groupByWorkspace: string
  readonly groupByWorkspaceTree: string
  readonly groupByFlat: string
  readonly orderByLabel: string
  readonly orderByManual: string
  readonly orderByUpdated: string
  readonly filterByLabel: string
  readonly hideArchived: string
  readonly showArchived: string
  readonly onlyArchived: string
}

/** One pickable menu row override: the id carries the default row's callback routing, the rest replaces it. */
export type ZoneViewOptionsOverride = { id: string; label?: ReactNode; icon?: ReactNode }

/**
 * The shared view-options dropdown: grouping (zones with Workspaces only),
 * ordering, and the archived filter, each section optional so a zone shows
 * only the choices its list supports; an overrides row replaces the default
 * copy of one pickable id (for example a zone without manual reorder reads
 * its `manual` row as the default order). The anchor is the sliders icon
 * button the Workspace browser's section header carries.
 * @param props.labels - localized menu labels.
 * @param props.sections - which sections the menu shows, in display order.
 * @param props.groupBy - current grouping (required with a `group` section).
 * @param props.orderBy - current ordering (required with an `order` section).
 * @param props.archivedFilter - current archived filter (required with a `filter` section).
 * @param props.onGroupPick - persist a grouping choice.
 * @param props.onOrderPick - persist an ordering choice.
 * @param props.onArchivedFilterPick - persist an archived-filter choice.
 * @param props.overrides - per-id row replacements (label/icon only; selection and routing stay on the id).
 * @param props.stopPropagation - stop click/key propagation to the accordion header so opening the menu does not fold the zone.
 * @returns the anchored menu element.
 */
export function ZoneViewOptions({ labels, sections, groupBy, orderBy, archivedFilter, onGroupPick, onOrderPick, onArchivedFilterPick, overrides, stopPropagation = false }: {
  labels: ZoneViewOptionsLabels
  sections: readonly ('group' | 'order' | 'filter')[]
  groupBy?: ZoneSessionGroupBy
  orderBy?: ZoneSessionOrderBy
  archivedFilter?: ZoneArchivedFilter
  onGroupPick?: (mode: ZoneSessionGroupBy) => void
  onOrderPick?: (mode: ZoneSessionOrderBy) => void
  onArchivedFilterPick?: (filter: ZoneArchivedFilter) => void
  overrides?: readonly ZoneViewOptionsOverride[]
  /** Stop click/keydown propagation (accordion header seats); panel bodies leave it off. */
  stopPropagation?: boolean
}): ReactNode {
  const [open, setOpen] = useState(false)
  const overrideOf = (id: string, label: string, icon: ReactNode): MenuItem => {
    const override = overrides?.find(row => row.id === id)
    return { id, label: override?.label ?? label, icon: override?.icon ?? icon }
  }
  const items: MenuEntry[] = []
  const selectedIds: string[] = []
  if (sections.includes('group') && groupBy !== undefined) {
    items.push(
      { type: 'label' as const, id: 'group-by', text: labels.groupByLabel },
      overrideOf('workspace', labels.groupByWorkspace, <IconFolderCloseRegular />),
      overrideOf('workspace-tree', labels.groupByWorkspaceTree, <IconWorkspaceTreeOutlineRegular />),
      overrideOf('flat', labels.groupByFlat, <IconFlatListOutlineRegular />),
    )
    selectedIds.push(groupBy)
  }
  if (sections.includes('order') && orderBy !== undefined) {
    if (items.length > 0) items.push({ type: 'separator' as const, id: 'order-by-separator' })
    items.push(
      { type: 'label' as const, id: 'order-by', text: labels.orderByLabel },
      overrideOf('manual', labels.orderByManual, <IconChevronsUpDownOutlineRegular />),
      overrideOf('updated', labels.orderByUpdated, <IconClockOutlineRegular />),
    )
    selectedIds.push(orderBy)
  }
  if (sections.includes('filter') && archivedFilter !== undefined) {
    if (items.length > 0) items.push({ type: 'separator' as const, id: 'archived-filter-separator' })
    items.push(
      { type: 'label' as const, id: 'filter-by', text: labels.filterByLabel },
      overrideOf('hide-archived', labels.hideArchived, <IconArchiveOffOutlineRegular />),
      overrideOf('show-archived', labels.showArchived, <IconQueueOutlineRegular />),
      overrideOf('only-archived', labels.onlyArchived, <IconArchiveCheckOutlineRegular />),
    )
    selectedIds.push({ default: 'hide-archived', show: 'show-archived', only: 'only-archived' }[archivedFilter])
  }
  return (
    <Menu
      open={open}
      onClose={() => { setOpen(false) }}
      items={items}
      selectedIds={selectedIds}
      onSelect={(id) => {
        if (id === 'workspace' || id === 'workspace-tree' || id === 'flat') onGroupPick?.(id)
        else if (id === 'manual' || id === 'updated') onOrderPick?.(id)
        else if (id === 'hide-archived') onArchivedFilterPick?.('default')
        else if (id === 'show-archived') onArchivedFilterPick?.('show')
        else if (id === 'only-archived') onArchivedFilterPick?.('only')
        setOpen(false)
      }}
      align="end"
      dense
      listClassName={css.viewOptionsMenu}
      // Portal: the zone header clips overflow, so an in-place list would be
      // cut off at the header's bounds.
      portal
      anchor={(
        <Tooltip label={labels.label} side="bottom" delayMs={500}>
          <button
            type="button"
            className={css.iconButton}
            aria-label={labels.label}
            onClick={(e) => {
              if (stopPropagation) e.stopPropagation()
              setOpen(v => !v)
            }}
            onKeyDown={stopPropagation ? (e) => { e.stopPropagation() } : undefined}
          >
            <IconSlidersTwoOutlineRegular />
          </button>
        </Tooltip>
      )}
    />
  )
}

/**
 * The shared trailing icon button (28px) used for a zone's extra action,
 * after the Workspace browser's Add workspace button.
 * @param props.label - localized accessible name and tooltip.
 * @param props.stopPropagation - stop click/key propagation to the accordion header so the click does not fold the zone.
 * @param props.onClick - run the action.
 * @returns the button element.
 */
export function ZoneAddWorkspace({ label, stopPropagation = false, onClick }: {
  label: string
  /** Stop click/keydown propagation (accordion header seats). */
  stopPropagation?: boolean
  onClick: () => void
}): ReactNode {
  return (
    <Tooltip label={label} side="bottom" delayMs={500}>
      <button
        type="button"
        className={css.iconButton}
        aria-label={label}
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation()
          onClick()
        }}
        onKeyDown={stopPropagation ? (e) => { e.stopPropagation() } : undefined}
      >
        <IconProjectAddOutlineRegular size={16} />
      </button>
    </Tooltip>
  )
}
