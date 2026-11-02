/** Secure-zone panel store: transient failure lines. */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

/** View-state the panel owns; Session history lives in the object layer. */
export interface SecureZonePanelState {
  /** Transient failure lines from history restore. */
  failures: readonly string[]
}

/** The panel store's action table. */
export type SecureZonePanelActions = {
  setFailures: (draft: SecureZonePanelState, failures: readonly string[]) => void
}

/**
 * Create the panel store: transient failure lines.
 * @returns a store factory whose instance the Slot registration owns.
 */
export function createSecureZoneStore(): EngineStoreHandle<SecureZonePanelState, SecureZonePanelActions> {
  return defineStore<SecureZonePanelState, SecureZonePanelActions>({
    init: () => ({
      failures: [],
    }),
    persist: 'dsh.securezone.view.v1',
    actions: {
      setFailures: (d, failures) => { d.failures = failures },
    },
  })
}
