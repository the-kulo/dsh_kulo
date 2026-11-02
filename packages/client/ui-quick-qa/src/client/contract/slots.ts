/** Quick answers slot inputs derived from its store, locale, and injected face. */

import type { HostObservable, InjectFace, PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { QuickQaListView, QuickQaSessionItem } from '../controller.ts'
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
    /** Standalone quick-answer conversations, pinned first then ordered by the zone's view options. */
    readonly sessionItems: HostObservable<readonly QuickQaSessionItem[]>
    /**
     * The zone's list viewing knobs (ordering, archived visibility), the same
     * persisted source the accordion header's view options write; the panel
     * reports it back so the controller re-derives its list.
     */
    readonly listView: HostObservable<QuickQaListView>
  }
  /**
   * The panel's one write back into the controller: apply the current
   * persisted zone knobs (mirrored from the `listView` hook) so the derived
   * list re-sorts/re-filters. The controller owns the list derivation; the
   * store stays presentation state.
   */
  controllerSetListView: (view: QuickQaListView) => void
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
