/** Source-safe discussion-room browser registration. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { DiscussionHistoryView } from './DiscussionHistoryView.tsx'
import { de, en, es, fr, ja, pt, ru, zh, NS, type DiscussionKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'discussion-room': DiscussionKey
  }
}

export const inject = ['slots', 'locale', 'remote']

/**
 * Mount the Remote first, then register UI after its namespace is available.
 * @param ctx - Client plugin context carrying slots, locale, and Remote registries.
 * @param contribution - Generated discussion-room Remote descriptors.
 * @returns disposer that removes UI before unmounting the Remote.
 */
export async function mountDiscussionRoom(ctx: Context, contribution: TypertRemoteContribution): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(contribution)
  const ui = ctx.inject(['remote.discussionRooms'], (inner: Context) => { registerDiscussionRoomUi(inner) })
  try {
    await ui
  } catch (error) {
    await ui.dispose()
    await unmount()
    throw error
  }
  return async () => {
    await ui.dispose()
    await unmount()
  }
}

function registerDiscussionRoomUi(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'client-ui-discussion-room: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'discussion-room',
    order: 40,
    locale: NS,
    label: () => t('tab.label'),
  }, DiscussionHistoryView))
}
