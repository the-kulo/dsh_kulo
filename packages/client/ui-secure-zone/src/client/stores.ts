/** Secure-zone panel store: transient failure lines and the persisted search draft. */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

/** View-state the panel owns; Session history lives in the object layer. */
export interface SecureZonePanelState {
  /** Transient failure lines from history restore. */
  failures: readonly string[]
  /**
   * Draft of the in-progress title filter, persisted like the Workspace
   * browser's view state so collapsing or remounting the zone keeps it.
   */
  query: string
}

/** The panel store's action table. */
export type SecureZonePanelActions = {
  setFailures: (draft: SecureZonePanelState, failures: readonly string[]) => void
  setQuery: (draft: SecureZonePanelState, query: string) => void
}

/**
 * Create the panel store: transient failure lines plus the persisted search draft.
 * @returns a store factory whose instance the Slot registration owns.
 */
export function createSecureZoneStore(): EngineStoreHandle<SecureZonePanelState, SecureZonePanelActions> {
  return defineStore<SecureZonePanelState, SecureZonePanelActions>({
    init: () => ({
      failures: [],
      query: '',
    }),
    persist: 'dsh.securezone.view.v1',
    actions: {
      setFailures: (d, failures) => { d.failures = failures },
      setQuery: (d, query) => { d.query = query },
    },
  })
}
