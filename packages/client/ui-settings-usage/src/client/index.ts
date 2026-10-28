/** Browser Settings section over the generated usageDashboard Remote namespace. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-usage/remote'
import { UsageSection } from './UsageSection.tsx'
import type { UsageSectionInjected } from './UsageSection.tsx'
import { en, ja, es, fr, de, ru, pt, zh, type UsageLocaleKey } from './locales.ts'

export type { UsageSectionInjected, UsageSectionProps } from './UsageSection.tsx'
export type { UsageLocaleKey } from './locales.ts'
export type { UsageSummary, UsageSummaryRequest } from '../types.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Token usage dashboard copy. */
    'settings.usage': UsageLocaleKey
  }
}

const NS = 'settings.usage'

/** Services supplied by the global Remote assembly and Settings renderer. */
export const inject = ['slots', 'locale', 'remote', 'remote.usageDashboard']

/** Register the localized Token usage section. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'ui-settings-usage: dictionaries')
  const t = ctx.locale.bind(NS)
  const injected = (): UsageSectionInjected => ({
    summary: async (request) => {
      const result = await ctx.remote.usageDashboard.summary(request)
      if (!result.ok) throw new Error(`usageDashboard.summary failed: ${result.error.code}: ${result.error.message}`)
      return result.value
    },
  })
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'usage', order: 20, label: () => t('title'), locale: NS, inject: injected,
  }, UsageSection))
}
