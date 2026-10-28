/** Browser entry for durable discussion-room history. */

import type { Context } from '@deepseek-ai/cordis'
import remote from '@deepseek-ai/dsh-experimental-discussion-room/remote'
import { mountDiscussionRoom } from './mount.ts'

export { inject } from './mount.ts'
export type { DiscussionHistoryViewProps } from './DiscussionHistoryView.tsx'
export type { DiscussionKey } from './locales.ts'

/** Mount the generated Remote and browser contributions. */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  return await mountDiscussionRoom(ctx, remote)
}
