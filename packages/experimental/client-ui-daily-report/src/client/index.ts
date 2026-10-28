/** Browser entry for durable daily-report history and source-session links. */
import type { Context } from '@deepseek-ai/cordis'
import remote from '@deepseek-ai/dsh-experimental-daily-report/remote'
import type {} from '@deepseek-ai/dsh-api-remote-access/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { DailyReportPage } from './DailyReportPage.tsx'
import { DailyReportIcon } from './DailyReportIcon.tsx'
import { createDailyReportSource, type DailyReportInjected } from './source.ts'
import { en, NS, zh, type DailyReportLocaleKey } from './locales.ts'

const PANEL_ID = 'daily-reports' as MainPanelId

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dailyReport': DailyReportLocaleKey
  }
}

export const inject = ['slots', 'locale', 'remote', 'remoteAccess', 'uiWorkspace']

export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(remote)
  const ui = ctx.inject(['remote.dailyReports'], (inner: Context) => {
    inner.effect(() => inner.locale.register(NS, { en, zh }), 'ui-daily-report: dictionaries')
    const t = inner.locale.bind(NS)
    inner.remoteAccess.whenAccess('dailyReports/list', function* () {
      const source = createDailyReportSource(
        () => inner.remote.dailyReports.list(),
        () => inner.remote.dailyReports.generate({}),
        listener => inner.on('connection/reset', listener),
      )
      yield inner.slots.inject('main', () => inner.slots.register({
        name: 'main', key: PANEL_ID, locale: NS,
        inject: (): DailyReportInjected => ({
          ...source,
          openSession: (sessionId: SessionId) => { inner.uiWorkspace.openSession(sessionId) },
        }),
      }, DailyReportPage))
      yield inner.slots.inject('sidebar.panellist', () => inner.slots.register({
        name: 'sidebar.panellist', id: PANEL_ID, locale: NS, label: () => t('panel'),
      }, DailyReportIcon))
    })
  })
  await ui
  return async () => {
    await ui.dispose()
    await unmount()
  }
}
