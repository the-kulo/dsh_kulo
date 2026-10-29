/** Secure-zone slot inputs derived from its store, locale, and injected face. */

import type { HostObservable, InjectFace, PropsLocale, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { SecureZoneExchangeView } from '../transcript.ts'
import type { createSecureZoneStore } from '../stores.ts'
import type { SecureZoneKey } from '../locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Secure zone history copy. */
    securezone: SecureZoneKey
  }
}

export type { SecureZoneExchangeView }

/**
 * Injected business face of the Secure zone history.
 *
 * `startSecureSession` carries the secure-zone semantics on the only channel
 * the Session-creation chain supports: `agentPreset: 'secure'` names the
 * shipped secure preset, and the Session's Workspace-free placement (Host
 * default directory, no Workspace membership) keeps it outside the workspace
 * zone. The preset id maps 1:1 to the model gateway's `secure` zone, whose
 * routing forces the local self-deployed model `LKL-GLM-5.2-FP8` and forbids
 * external models and external tools.
 */
export interface SecureZoneInjected {
  readonly hooks: {
    /** Exchanges folded from the durable Session event window. */
    readonly exchanges: HostObservable<readonly SecureZoneExchangeView[]>
  }
  /** Create a new secure-zone Session under the secure preset and open it. */
  startSecureSession: () => void
}

/** Full component props of the history view. */
export type SecureZonePanelProps =
  PropsStore<ReturnType<typeof createSecureZoneStore>>
  & PropsLocale<'securezone'>
  & InjectFace<SecureZoneInjected>
