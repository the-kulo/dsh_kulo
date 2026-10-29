/** Quick answers slot inputs derived from its store, locale, and injected face. */

import type { HostObservable, InjectFace, PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { QuickQaExchangeView } from '../transcript.ts'
import type { createQuickQaStore } from '../stores.ts'
import type { QuickQaKey } from '../locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Quick answers history copy. */
    quickqa: QuickQaKey
  }
}

export type { QuickQaExchangeView }

/**
 * Injected business face of the Quick answers history.
 *
 * `startQuickSession` carries the quick-qa zone semantics on the only channel
 * the Session-creation chain supports: `agentPreset: 'quick-qa'` names the
 * shipped tool-free preset, and the Session's Workspace-free placement (Host
 * default directory, no Workspace membership) keeps it outside the workspace
 * zone. The preset id maps 1:1 to the model gateway's `quick-qa` zone, whose
 * routing limits the Session to flash-class pool models.
 */
export interface QuickQaInjected {
  readonly hooks: {
    /** Exchanges folded from the durable Session event window. */
    readonly exchanges: HostObservable<readonly QuickQaExchangeView[]>
  }
  /** Create a new quick-answer Session under the quick-qa preset and open it. */
  startQuickSession: () => void
}

/** Full component props of the history view. */
export type QuickQaPanelProps =
  PropsStore<ReturnType<typeof createQuickQaStore>>
  & PropsLocale<'quickqa'>
  & InjectFace<QuickQaInjected>
