/**
 * One sidebar zone under the Workspace browser (workspace, quick-qa, or
 * secure). The header carries the zone title, a collapse chevron, and a New
 * conversation button; the body fills the zone's share of the sidebar height
 * and scrolls independently while expanded. Expansion persists in the
 * browser's viewing store and is mutually exclusive across the three zones
 * (the store folds the others when one opens), so a reload restores the one
 * open zone.
 */
import { memo, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  IconChevronDownOutlineRegular, IconChevronRightOutlineRegular, IconNewChatOutlineRegular, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import css from './AccordionSection.module.css'

export interface AccordionSectionProps {
  /** Zone identity in the persisted expansion map. */
  sectionKey: string
  /** Localized zone title. */
  title: string
  /** Whether the body renders; collapsing keeps the header visible. */
  expanded: boolean
  /** Persist one expansion change. */
  onExpandedChange: (expanded: boolean) => void
  /** Localized label of the New conversation action. */
  newLabel: string
  /** Create one new conversation in this zone. */
  onNew: () => void
  /** Zone content; receives the scroll container class. */
  children: ReactNode
}

/**
 * Render one accordion zone: collapsible header plus an independently
 * scrolling body. The whole header row is the toggle (Enter/Space toggle),
 * matching how the sibling Workspace browser reads as one row; the New
 * conversation button stops propagation so creating does not fold the zone.
 * @param props - zone identity, title, expansion state, and the new-conversation action.
 * @returns the zone element tree.
 */
export const AccordionSection = memo(function AccordionSection({
  sectionKey,
  title,
  expanded,
  onExpandedChange,
  newLabel,
  onNew,
  children,
}: AccordionSectionProps) {
  const toggle = (): void => { onExpandedChange(!expanded) }
  return (
    <section className={clsx(css.root, expanded && css.expanded)} data-zone={sectionKey}>
      <div
        className={css.header}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={`sidebar-zone-${sectionKey}`}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          toggle()
        }}
      >
        {expanded
          ? <IconChevronDownOutlineRegular size={16} className={css.chevron} />
          : <IconChevronRightOutlineRegular size={16} className={css.chevron} />}
        <span className={css.title}>{title}</span>
        <Tooltip label={newLabel} side="bottom" delayMs={500}>
          <button
            type="button"
            className={css.newButton}
            aria-label={newLabel}
            onClick={(event) => {
              event.stopPropagation()
              onNew()
            }}
          >
            <IconNewChatOutlineRegular size={16} />
          </button>
        </Tooltip>
      </div>
      {expanded && (
        <div className={css.body} id={`sidebar-zone-${sectionKey}`}>
          {children}
        </div>
      )}
    </section>
  )
})
