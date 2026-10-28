import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { mountDiscussionRoom, inject } from '../src/client/mount.ts'
import { DiscussionHistoryView } from '../src/client/DiscussionHistoryView.tsx'
import { apply as hostApply } from '../src/index.ts'

const contribution = { package: '@deepseek-ai/dsh-experimental-discussion-room', descriptors: [] }

describe('discussion-room browser plugin', () => {
  it('registers only the disposable durable history tab', async () => {
    hostApply()
    const ctx = new Context()
    await ctx.plugin(SlotRegistry)
    ctx.slots.register({ name: 'root', inject: () => ({}), children: {
      'conversation.session.header.actions': { kind: 'list', scope: 'session' },
      'conversation.view': { kind: 'list', scope: 'session' },
    } }, (_props: { renderSlot?: unknown }) => null)
    const unmount = vi.fn(async () => {})
    ctx.provide('remote', { discussionRooms: {}, $mount: vi.fn(async () => unmount) })
    ctx.provide('remote.discussionRooms', {})
    ctx.provide('locale', new LocaleRuntime(ctx))
    const fiber = ctx.plugin({ inject, apply: (inner: Context) => mountDiscussionRoom(inner, contribution) })
    await fiber.await()

    expect(inject).toEqual(['slots', 'locale', 'remote'])
    expect(ctx.slots.entries('conversation.session.header.actions')).toHaveLength(0)
    expect(ctx.slots.entries('conversation.view').find(candidate => candidate.component === DiscussionHistoryView))
      .toMatchObject({ options: { id: 'discussion-room', order: 40 }, locale: 'discussion-room' })
    expect(ctx.locale.bind('discussion-room')('tab.label')).toBe('Discussion')

    await fiber.dispose()
    expect(unmount).toHaveBeenCalledOnce()
    expect(ctx.slots.entries('conversation.view')).toHaveLength(0)
    expect(ctx.locale.bind('discussion-room')('tab.label')).toBe('tab.label')
  })
})
