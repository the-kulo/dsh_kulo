/** Secure zone browser plugin over one durable, tool-free secure-zone Session history. */

import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import { createSecureZoneStore } from './stores.ts'
import { SecureZoneController } from './controller.ts'
import { SecureZonePanel } from './SecureZonePanel.tsx'
import { en, ja, es, fr, de, ru, pt, zh } from './locales.ts'
import type { SecureZoneInjected } from './contract/slots.ts'

export type { SecureZoneInjected, SecureZonePanelProps } from './contract/slots.ts'
export type { SecureZoneExchangeView } from './transcript.ts'
export type { SecureZoneKey } from './locales.ts'

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    /** Secure zone history's durable Session reference. */
    secureZonePanel: unknown
  }
}

const NS = 'securezone'

export const inject = ['slots', 'sessions', 'locale', 'uiWorkspace']

/**
 * Mount the read-only Secure zone history as the sidebar's secure zone.
 *
 * The registration carries no title: the zone accordion's header (rendered
 * by ui-workspace, which declares the `sidebar.workspaces.footer` hole)
 * owns the zone title, collapse chevron, and New conversation button; this
 * panel renders only the scrollable history. Its New conversation action
 * creates a secure-zone Session through `ctx.uiWorkspace`: the secure-zone
 * semantics ride on the `quick` placement plus the `secure` preset id (see
 * contract/slots.ts).
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'ui-secure-zone: dictionaries')
  const viewStore = createSecureZoneStore()
  const viewInstance = viewStore.create()
  const view = { ...viewStore, create: () => viewInstance }
  const controller = new SecureZoneController(ctx, ctx.get('sessions') as ISessions, viewInstance)
  ctx.effect(() => () => { controller.dispose() }, 'ui-secure-zone: controller')
  void controller.start().catch((error: unknown) => { ctx.logger.warn(String(error)) })

  const uiWorkspace = ctx.get('uiWorkspace')
  if (uiWorkspace === undefined) throw new Error('dsh-client-ui-secure-zone requires the uiWorkspace service')
  ctx.slots.inject('sidebar.workspaces.footer', () => ctx.slots.register(
    {
      name: 'sidebar.workspaces.footer',
      id: 'secure-zone',
      locale: NS,
      store: view,
      inject: (): SecureZoneInjected => ({
        hooks: {
          exchanges: controller.exchanges,
        },
        // The secure zone's New conversation: a Workspace-free Session under
        // the shipped secure preset. The preset id maps to the gateway's
        // secure zone, whose routing forces the local LKL-GLM-5.2-FP8 model.
        startSecureSession: () => {
          uiWorkspace.startSession(undefined, { agentPreset: 'secure' })
        },
      }),
    },
    SecureZonePanel,
  ))
}
