/**
 * One sidebar zone under the Workspace browser (quick-qa or secure). The
 * header carries the zone title, a collapse chevron, and a New conversation
 * button; the body fills the zone's share of the sidebar height and scrolls
 * independently while expanded. Expansion persists in the browser's viewing
 * store, so a reload restores the layout.
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
 * scrolling body.
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
  return (
    <section className={clsx(css.root, expanded && css.expanded)} data-zone={sectionKey}>
      <div className={css.header}>
        <button
          type="button"
          className={css.headerMain}
          aria-expanded={expanded}
          aria-controls={`sidebar-zone-${sectionKey}`}
          onClick={() => { onExpandedChange(!expanded) }}
        >
          {expanded
            ? <IconChevronDownOutlineRegular size={12} className={css.chevron} />
            : <IconChevronRightOutlineRegular size={12} className={css.chevron} />}
          <span className={css.title}>{title}</span>
        </button>
        <Tooltip label={newLabel} side="bottom" delayMs={500}>
          <button
            type="button"
            className={css.newButton}
            aria-label={newLabel}
            onClick={onNew}
          >
            <IconNewChatOutlineRegular size={14} />
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
