/** Secure zone browser plugin over one durable, tool-free secure-zone Session history. */

import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { IWorkspaces } from '@deepseek-ai/dsh-api-workspace-controller/client'
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
    /** Secure zone history's rename operation. */
    secureZoneRename: unknown
  }
}

const NS = 'securezone'

export const inject = ['slots', 'sessions', 'workspaces', 'locale', 'uiWorkspace']

/**
 * Mount the read-only Secure zone history as the sidebar's secure zone.
 *
 * The registration carries no title: the zone accordion's header (rendered
 * by ui-workspace, which declares the `sidebar.workspaces.footer` hole)
 * owns the zone title, collapse chevron, and New conversation button; this
 * panel renders only the scrollable history. Its New conversation action
 * creates an independent secure-zone Session (Host default directory, no
 * Workspace membership) under the local-model secure preset and opens it as
 * the current Session (see contract/slots.ts).
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'ui-secure-zone: dictionaries')
  const viewStore = createSecureZoneStore()
  const viewInstance = viewStore.create()
  const view = { ...viewStore, create: () => viewInstance }
  const uiWorkspace = ctx.get('uiWorkspace') as UiWorkspace
  const controller = new SecureZoneController(
    ctx,
    ctx.get('sessions') as ISessions,
    ctx.get('workspaces') as IWorkspaces,
    uiWorkspace,
    viewInstance,
  )
  ctx.effect(() => () => { controller.dispose() }, 'ui-secure-zone: controller')
  void controller.start().catch((error: unknown) => { ctx.logger.warn(String(error)) })

  ctx.slots.inject('sidebar.workspaces.footer', () => ctx.slots.register(
    {
      name: 'sidebar.workspaces.footer',
      id: 'secure-zone',
      locale: NS,
      store: view,
      inject: (): SecureZoneInjected => ({
        hooks: {
          sessionItems: controller.sessionItems,
          // The zone's list viewing knobs live in the Workspace browser's
          // persisted viewing store; the panel reports them back so the
          // controller re-derives its list.
          listView: uiWorkspace.zoneListViewSource('secure'),
        },
        controllerSetListView: (zoneView) => { controller.setListView(zoneView) },
        // The secure zone's New conversation: an independent local-only
        // Session under the shipped secure preset, opened as the current
        // Session. The preset id maps to the gateway's secure zone, whose
        // routing forces the local LKL-GLM-5.2-FP8 model.
        startSecureSession: () => {
          void controller.createSession().catch((error: unknown) => {
            ctx.logger.warn(String(error))
          })
        },
        openSession: (sessionId) => { controller.openSession(sessionId) },
        searchSessions: (query, signal) => controller.searchSessions(query, signal),
        searchResultLimit: (ctx.get('sessions') as ISessions).searchResultLimit,
        renameSession: (sessionId, title) => controller.renameSession(sessionId, title),
        deleteSession: (sessionId) => controller.deleteSession(sessionId),
        archiveSession: (sessionId) => controller.archiveSession(sessionId),
        unarchiveSession: (sessionId) => controller.unarchiveSession(sessionId),
        pinSession: (sessionId) => controller.pinSession(sessionId),
        unpinSession: (sessionId) => controller.unpinSession(sessionId),
      }),
    },
    SecureZonePanel,
  ))
}
