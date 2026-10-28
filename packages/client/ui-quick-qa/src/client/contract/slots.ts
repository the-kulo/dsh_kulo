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

/** Injected business face of the Quick answers history. */
export interface QuickQaInjected {
  readonly hooks: {
    /** Exchanges folded from the durable Session event window. */
    readonly exchanges: HostObservable<readonly QuickQaExchangeView[]>
  }
}

/** Full component props of the history view. */
export type QuickQaPanelProps =
  PropsStore<ReturnType<typeof createQuickQaStore>>
  & PropsLocale<'quickqa'>
  & InjectFace<QuickQaInjected>
