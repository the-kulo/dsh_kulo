/** Quick answers history write-side store: transient failure lines. */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

/** View-state the history owns; Session history lives in the object layer. */
export interface QuickQaPanelState {
  /** Transient failure lines from history restore. */
  failures: readonly string[]
}

/** The history store's action table. */
export type QuickQaPanelActions = {
  setFailures: (draft: QuickQaPanelState, failures: readonly string[]) => void
}

/**
 * Create the history store: transient failure lines.
 * @returns a store factory whose instance the Slot registration owns.
 */
export function createQuickQaStore(): EngineStoreHandle<QuickQaPanelState, QuickQaPanelActions> {
  return defineStore<QuickQaPanelState, QuickQaPanelActions>({
    init: () => ({
      failures: [],
    }),
    persist: 'dsh.quickqa.view.v1',
    actions: {
      setFailures: (d, failures) => { d.failures = failures },
    },
  })
}
