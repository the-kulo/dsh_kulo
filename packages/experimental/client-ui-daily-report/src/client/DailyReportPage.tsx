import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { DailyReport } from '@deepseek-ai/dsh-experimental-daily-report/types'
import type { DailyReportInjected } from './source.ts'
import type { DailyReportLocaleKey } from './locales.ts'

export type DailyReportPageProps = PropsRuntime<'main'> & InjectFace<DailyReportInjected> & PropsLocale<'dailyReport'>

function Section({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null
  return <section><h3>{title}</h3><ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul></section>
}

function Report({ report, t, openSession }: {
  report: DailyReport
  t: (key: DailyReportLocaleKey) => string
  openSession: DailyReportInjected['openSession']
}) {
  return <article>
    <h2>{report.date}</h2>
    <p>{report.status === 'failed' ? report.error ?? t('failed') : report.status === 'empty' ? t('noActivity') : null}</p>
    <Section title={t('completed')} items={report.completed} />
    <Section title={t('inProgress')} items={report.inProgress} />
    <Section title={t('blocked')} items={report.blocked} />
    <Section title={t('followUp')} items={report.followUp} />
    {report.sources.length > 0 && <section><h3>{t('sources')}</h3><ul>{report.sources.map(source =>
      <li key={source.sessionId}><button type="button" onClick={() => { openSession(source.sessionId) }}>{source.title}</button></li>)}</ul></section>}
  </article>
}

/** Render durable report attempts and explicit source-session navigation. */
export function DailyReportPage(props: DailyReportPageProps) {
  const { useReports, generate, openSession, t } = props
  const { records, status, generating } = useReports(snapshot => snapshot)
  return <main>
    <header><h1>{t('title')}</h1><Button disabled={generating} onClick={() => { void generate() }}>
      {generating ? t('generating') : status === 'error' ? t('retry') : t('generate')}
    </Button></header>
    {status === 'loading' && records.length === 0 ? <p>{t('loading')}</p>
      : records.length === 0 ? <p>{t('empty')}</p>
        : records.map(report => <Report key={report.id} report={report} t={t} openSession={openSession} />)}
  </main>
}
