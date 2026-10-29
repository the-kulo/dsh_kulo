/** Secure-zone history write-side store: transient failure lines only. */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

/** View-state the history owns; Session history lives in the object layer. */
export interface SecureZonePanelState {
  /** Transient failure lines from history restore. */
  failures: readonly string[]
}

/** The history store's action table. */
export type SecureZonePanelActions = {
  setFailures: (draft: SecureZonePanelState, failures: readonly string[]) => void
}

/**
 * Create the history store for transient failure lines.
 * @returns a store factory whose instance the Slot registration owns.
 */
export function createSecureZoneStore(): EngineStoreHandle<SecureZonePanelState, SecureZonePanelActions> {
  return defineStore<SecureZonePanelState, SecureZonePanelActions>({
    init: () => ({
      failures: [],
    }),
    actions: {
      setFailures: (d, failures) => { d.failures = failures },
    },
  })
}
