/** Quick answers browser plugin over one durable, tool-free Session history. */

import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
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

export const inject = ['slots', 'sessions', 'locale']

/** Mount the read-only Quick answers history below the Workspace browser. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'ui-quick-qa: dictionaries')
  const viewStore = createQuickQaStore()
  const viewInstance = viewStore.create()
  const view = { ...viewStore, create: () => viewInstance }
  const controller = new QuickQaController(ctx, ctx.get('sessions') as ISessions, viewInstance)
  ctx.effect(() => () => { controller.dispose() }, 'ui-quick-qa: controller')
  void controller.start().catch((error: unknown) => { ctx.logger.warn(String(error)) })

  ctx.slots.inject('sidebar.workspaces.footer', () => ctx.slots.register(
    {
      name: 'sidebar.workspaces.footer',
      locale: NS,
      store: view,
      inject: (): QuickQaInjected => ({
        hooks: {
          exchanges: controller.exchanges,
        },
      }),
    },
    QuickQaPanel,
  ))
}
