import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { TeamHistoryView } from '../src/client/TeamHistoryView.tsx'
import { apply, inject } from '../src/client/index.ts'
import { apply as nodeApply } from '../src/index.ts'

async function bench() {
  const ctx = new Context()
  ctx.provide('locale', new LocaleRuntime(ctx))
  await ctx.plugin(SlotRegistry).await()
  const collapse = ctx.slots.register({
    name: 'root',
    children: { 'conversation.view': { kind: 'list', scope: 'session' } },
  } as never, () => null)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber, collapse }
}

describe('ui-team browser plugin', () => {
  it('registers only the disposable history tab', async () => {
    nodeApply()
    const b = await bench()
    expect(inject).toEqual(['slots', 'locale'])
    expect(b.ctx.slots.entries('conversation.view').find(candidate => candidate.component === TeamHistoryView))
      .toMatchObject({ options: { id: 'agent-team', order: 20 }, locale: 'agent-team' })
    expect(b.ctx.locale.bind('agent-team')('tab.label')).toBe('Team')

    await b.fiber.dispose()
    expect(b.ctx.slots.entries('conversation.view')).toHaveLength(0)
    expect(b.ctx.locale.bind('agent-team')('tab.label')).toBe('tab.label')
  })

  it('re-registers the history tab after its declaration is replaced', async () => {
    const b = await bench()
    b.collapse()
    expect(b.ctx.slots.entries('conversation.view')).toHaveLength(0)
    b.ctx.slots.register({
      name: 'root',
      children: { 'conversation.view': { kind: 'list', scope: 'session' } },
    } as never, () => null)
    await Promise.resolve()
    expect(b.ctx.slots.entries('conversation.view')).toHaveLength(1)
    await b.ctx.fiber.dispose()
  })
})
