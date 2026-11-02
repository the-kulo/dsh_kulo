/** Quick answers browser plugin over one durable, tool-free Session history. */

import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { IWorkspaces } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { UiWorkspace } from '@deepseek-ai/dsh-client-ui-workspace/client'
import { createQuickQaStore } from './stores.ts'
import { QuickQaController } from './controller.ts'
import { QuickQaPanel } from './QuickQaPanel.tsx'
import { en, ja, es, fr, de, ru, pt, zh } from './locales.ts'
import type { QuickQaInjected } from './contract/slots.ts'

export type { QuickQaInjected, QuickQaPanelProps } from './contract/slots.ts'
export type { QuickQaExchangeView } from './transcript.ts'
export type { QuickQaKey } from './locales.ts'

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    /** Quick answers history's durable Session reference. */
    quickQaPanel: unknown
  }
}

const NS = 'quickqa'

export const inject = ['slots', 'sessions', 'workspaces', 'locale', 'uiWorkspace']

/**
 * Mount the read-only Quick answers history as the sidebar's quick-qa zone.
 *
 * The registration no longer carries a title: the zone accordion's header
 * (rendered by ui-workspace, which declares the `sidebar.workspaces.footer`
 * hole) owns the zone title, collapse chevron, and New conversation button;
 * this panel renders only the scrollable history. Its New conversation
 * action creates an independent quick-answer Session through the Host's
 * `quick` placement (no Workspace membership), so the conversation never
 * inherits a Workspace; the preset id maps to the gateway's quick-qa zone
 * for model routing (see contract/slots.ts).
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'ui-quick-qa: dictionaries')
  const viewStore = createQuickQaStore()
  const viewInstance = viewStore.create()
  const view = { ...viewStore, create: () => viewInstance }
  const uiWorkspace = ctx.get('uiWorkspace') as UiWorkspace
  const controller = new QuickQaController(
    ctx,
    ctx.get('sessions') as ISessions,
    ctx.get('workspaces') as IWorkspaces,
    uiWorkspace,
    viewInstance,
  )
  ctx.effect(() => () => { controller.dispose() }, 'ui-quick-qa: controller')
  void controller.start().catch((error: unknown) => { ctx.logger.warn(String(error)) })

  ctx.slots.inject('sidebar.workspaces.footer', () => ctx.slots.register(
    {
      name: 'sidebar.workspaces.footer',
      id: 'quick-qa',
      locale: NS,
      store: view,
      inject: (): QuickQaInjected => ({
        hooks: {
          sessionItems: controller.sessionItems,
          // The zone's list viewing knobs live in the Workspace browser's
          // persisted viewing store; the panel reports them back so the
          // controller re-derives its list.
          listView: uiWorkspace.zoneListViewSource('quick-qa'),
        },
        controllerSetListView: (zoneView) => { controller.setListView(zoneView) },
        // The quick-qa zone's New conversation: an independent quick-answer
        // Session under the shipped quick-qa preset, opened as the current
        // Session. The preset id maps to the gateway's quick-qa zone for
        // model routing.
        startQuickSession: () => {
          void controller.createSession().catch((error: unknown) => {
            ctx.logger.warn(String(error))
          })
        },
        openSession: (sessionId) => { controller.openSession(sessionId) },
        renameSession: (sessionId, title) => controller.renameSession(sessionId, title),
        deleteSession: (sessionId) => controller.deleteSession(sessionId),
        archiveSession: (sessionId) => controller.archiveSession(sessionId),
        unarchiveSession: (sessionId) => controller.unarchiveSession(sessionId),
        pinSession: (sessionId) => controller.pinSession(sessionId),
        unpinSession: (sessionId) => controller.unpinSession(sessionId),
      }),
    },
    QuickQaPanel,
  ))
}
