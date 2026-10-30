/** Quick answers slot inputs derived from its store, locale, and injected face. */

import type { HostObservable, InjectFace, PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { QuickQaSessionItem } from '../controller.ts'
import type { createQuickQaStore } from '../stores.ts'
import type { QuickQaKey } from '../locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Quick answers history copy. */
    quickqa: QuickQaKey
  }
}

export type { QuickQaSessionItem }

/**
 * Injected business face of the Quick answers history.
 *
 * `startQuickSession` carries the quick-qa zone semantics on the only channel
 * the Session-creation chain supports: creating the Session with the Host's
 * `quick` placement (default directory, no Workspace membership) keeps it
 * outside every Workspace, and `agentPreset: 'quick-qa'` names the shipped
 * tool-free preset. The preset id maps 1:1 to the model gateway's `quick-qa`
 * zone, whose routing limits the Session to flash-class pool models.
 */
export interface QuickQaInjected {
  readonly hooks: {
    /** Standalone quick-answer conversations, pinned first then newest first, archived excluded. */
    readonly sessionItems: HostObservable<readonly QuickQaSessionItem[]>
  }
  /** Create a new quick-answer Session under the quick-qa preset and open it. */
  startQuickSession: () => void
  /** Open one listed conversation as the current Main Session. */
  openSession: (sessionId: SessionId) => void
  /** Rename a quick-answer Session. */
  renameSession: (sessionId: SessionId, title: string) => Promise<void>
  /** Permanently delete a quick-answer Session. */
  deleteSession: (sessionId: SessionId) => Promise<void>
  /** Archive a quick-answer Session (hidden from the default list). */
  archiveSession: (sessionId: SessionId) => Promise<void>
  /** Unarchive a quick-answer Session (restores it to the list). */
  unarchiveSession: (sessionId: SessionId) => Promise<void>
  /** Pin a quick-answer Session (sorted before unpinned rows). */
  pinSession: (sessionId: SessionId) => Promise<void>
  /** Unpin a quick-answer Session. */
  unpinSession: (sessionId: SessionId) => Promise<void>
}

/** Full component props of the history view. */
export type QuickQaPanelProps =
  PropsStore<ReturnType<typeof createQuickQaStore>>
  & PropsLocale<'quickqa'>
  & InjectFace<QuickQaInjected>
