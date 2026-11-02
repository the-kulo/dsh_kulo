/** Secure-zone slot inputs derived from its store, locale, and injected face. */

import type { HostObservable, InjectFace, PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionSearchResultItem } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SecureZoneListView, SecureZoneSessionItem } from '../controller.ts'
import type { createSecureZoneStore } from '../stores.ts'
import type { SecureZoneKey } from '../locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Secure zone history copy. */
    securezone: SecureZoneKey
  }
}

export type { SecureZoneSessionItem }

/**
 * Injected business face of the Secure zone history.
 *
 * `startSecureSession` carries the secure-zone semantics on the only channel
 * the Session-creation chain supports: creating the Session with the Host's
 * `quick` placement (default directory, no Workspace membership) keeps it
 * outside every Workspace, and `agentPreset: 'secure'` names the shipped
 * local-only preset. The preset id maps 1:1 to the model gateway's `secure`
 * zone, whose routing forces the local self-deployed model `LKL-GLM-5.2-FP8`
 * and forbids external models and external tools.
 */
export interface SecureZoneInjected {
  readonly hooks: {
    /** Standalone secure-zone conversations, pinned first then ordered by the zone's view options. */
    readonly sessionItems: HostObservable<readonly SecureZoneSessionItem[]>
    /**
     * The zone's list viewing knobs (ordering, archived visibility), the same
     * persisted source the accordion header's view options write; the panel
     * reports it back so the controller re-derives its list.
     */
    readonly listView: HostObservable<SecureZoneListView>
  }
  /**
   * The panel's one write back into the controller: apply the current
   * persisted zone knobs (mirrored from the `listView` hook) so the derived
   * list re-sorts/re-filters. The controller owns the list derivation; the
   * store stays presentation state.
   */
  controllerSetListView: (view: SecureZoneListView) => void
  /** Create a new secure-zone Session under the secure preset and open it. */
  startSecureSession: () => void
  /** Open one listed conversation as the current Main Session. */
  openSession: (sessionId: SessionId) => void
  /**
   * Search current visible conversation messages on the Host. The Host fixes
   * the result bound; `hasMore` means the query needs narrowing. The panel
   * intersects the hits with its own zone list, so results stay zone-local.
   */
  searchSessions: (
    query: string,
    signal: AbortSignal,
  ) => Promise<{ items: readonly SessionSearchResultItem[]; hasMore: boolean }>
  /** Maximum number of merged rows rendered for one search. */
  searchResultLimit: number
  /** Rename a secure-zone Session. */
  renameSession: (sessionId: SessionId, title: string) => Promise<void>
  /** Permanently delete a secure-zone Session. */
  deleteSession: (sessionId: SessionId) => Promise<void>
  /** Archive a secure-zone Session (hidden from the default list). */
  archiveSession: (sessionId: SessionId) => Promise<void>
  /** Unarchive a secure-zone Session (restores it to the list). */
  unarchiveSession: (sessionId: SessionId) => Promise<void>
  /** Pin a secure-zone Session (sorted before unpinned rows). */
  pinSession: (sessionId: SessionId) => Promise<void>
  /** Unpin a secure-zone Session. */
  unpinSession: (sessionId: SessionId) => Promise<void>
}

/** Full component props of the history view. */
export type SecureZonePanelProps =
  PropsStore<ReturnType<typeof createSecureZoneStore>>
  & PropsLocale<'securezone'>
  & InjectFace<SecureZoneInjected>
