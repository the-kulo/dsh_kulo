import { Context } from '@deepseek-ai/cordis'
import { expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { UsageSection } from '../src/client/UsageSection.tsx'
import { apply, inject } from '../src/client/index.ts'

it('uses the global usage Remote and disposes the Settings section', async () => {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry)
  ctx.slots.register({ name: 'root', inject: () => ({}), children: {
    'settings.section': { kind: 'list', scope: 'root' },
  } }, (_props: { renderSlot?: unknown }) => null)
  const summary = vi.fn()
  const mount = vi.fn()
  ctx.provide('remote', { usageDashboard: { summary }, $mount: mount })
  ctx.provide('remote.usageDashboard', { summary })
  ctx.provide('locale', new LocaleRuntime(ctx))
  const fiber = ctx.plugin({ inject, apply })
  await fiber.await()
  expect(ctx.slots.entries('settings.section').some(entry => entry.component === UsageSection)).toBe(true)
  await fiber.dispose()
  expect(mount).not.toHaveBeenCalled()
  expect(ctx.slots.entries('settings.section')).toHaveLength(0)
  await ctx.fiber.dispose()
})
