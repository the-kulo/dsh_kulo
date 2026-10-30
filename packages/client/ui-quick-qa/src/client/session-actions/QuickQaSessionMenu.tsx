/**
 * The quick-qa session row's "…" menu: pin/unpin, rename, archive/unarchive,
 * and delete entries that close the menu and hand the row identity to the
 * panel's injected actions. The dialog surfaces (delete confirmation, rename
 * input) live outside the row so they outlive the menu unmount.
 */
import { useState } from 'react'
import {
  IconArchiveOutlineRegular,
  IconEllipsisOutlineRegular,
  IconPinFillRegular,
  IconPinOutlineRegular,
  Menu,
  MenuItemButton,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { QuickQaPanelProps, QuickQaSessionItem } from '../contract/slots.ts'
import css from '../QuickQaPanel.module.css'

/** Props of one session row's trailing actions. */
interface QuickQaSessionMenuProps {
  /** Row the menu acts on. */
  item: QuickQaSessionItem
  /** Current display title (blank rows already show the localized New Session label). */
  displayTitle: string
  /** Injected business actions; the panel wires them to the controller. */
  archiveSession: QuickQaPanelProps['archiveSession']
  unarchiveSession: QuickQaPanelProps['unarchiveSession']
  pinSession: QuickQaPanelProps['pinSession']
  unpinSession: QuickQaPanelProps['unpinSession']
  /** Ask the panel-level rename dialog to open for this row. */
  onRenameRequest: (sessionId: SessionId, currentTitle: string) => void
  /** Ask the panel-level delete confirmation to open for this row. */
  onDeleteRequest: (sessionId: SessionId, displayTitle: string) => void
  /** The panel's locale seat. */
  t: QuickQaPanelProps['t']
}

/** One session row's "…" menu: pin/unpin, rename, archive/unarchive, delete. */
export function QuickQaSessionMenu({
  item,
  displayTitle,
  archiveSession,
  unarchiveSession,
  pinSession,
  unpinSession,
  onRenameRequest,
  onDeleteRequest,
  t,
}: QuickQaSessionMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pinned = item.pinned
  const archived = item.archived
  const close = (): void => { setMenuOpen(false) }

  return (
    <span className={css.rowActions} onClick={(event) => { event.stopPropagation() }}>
      <Menu
        open={menuOpen}
        onClose={close}
        portal
        closeOnPointerLeave
        anchor={(
          <button
            type="button"
            className={css.iconButton}
            aria-label={t('actions.session.aria', { name: displayTitle })}
            onClick={() => { setMenuOpen(value => !value) }}
          >
            <IconEllipsisOutlineRegular />
          </button>
        )}
      >
        <MenuItemButton
          icon={pinned ? <IconPinFillRegular size={14} /> : <IconPinOutlineRegular size={14} />}
          onSelect={() => {
            close()
            const action = pinned ? unpinSession : pinSession
            void action(item.id).catch(() => {})
          }}
        >
          {t(pinned ? 'menu.unpinSession' : 'menu.pinSession')}
        </MenuItemButton>
        <MenuItemButton
          onSelect={() => {
            close()
            onRenameRequest(item.id, item.title)
          }}
        >
          {t('menu.renameSession')}
        </MenuItemButton>
        <MenuItemButton
          icon={<IconArchiveOutlineRegular size={14} />}
          onSelect={() => {
            close()
            const action = archived ? unarchiveSession : archiveSession
            void action(item.id).catch(() => {})
          }}
        >
          {t(archived ? 'menu.unarchiveSession' : 'menu.archiveSession')}
        </MenuItemButton>
        <MenuItemButton
          danger
          onSelect={() => {
            close()
            onDeleteRequest(item.id, displayTitle)
          }}
        >
          {t('menu.deleteSession')}
        </MenuItemButton>
      </Menu>
    </span>
  )
}
