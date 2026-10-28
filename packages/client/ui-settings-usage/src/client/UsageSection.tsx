/** Settings dashboard for provider-reported token usage. */

import { useCallback, useEffect, useState } from 'react'
import { Button, Input, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { UsageSummary, UsageSummaryRequest, UsageTotals } from '../types.ts'
import { shanghaiDay } from '../usage.ts'
import css from './UsageSection.module.css'

/** Remote face injected by the Client plugin. */
export interface UsageSectionInjected {
  /** Read one inclusive Shanghai-day range. */
  readonly summary: (request: UsageSummaryRequest) => Promise<UsageSummary>
}

/** Props supplied by the Settings slot renderer. */
export type UsageSectionProps = PropsRuntime<'settings.section'>
  & PropsLocale<'settings.usage'>
  & InjectFace<UsageSectionInjected>

type LoadState =
  | { readonly status: 'loading' | 'error'; readonly snapshot?: UsageSummary }
  | { readonly status: 'ready'; readonly snapshot: UsageSummary }

const DAY_MS = 86_400_000

function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay()
}

function shiftDay(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

function minDay(left: string, right: string): string {
  return left < right ? left : right
}

function isDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
}

/** One calendar cell: a Shanghai day, or null for a week-start pad slot. */
export interface UsageCalendarCell {
  readonly date: string | null
  readonly totals: UsageTotals | undefined
}

export interface UsageCalendarModel {
  readonly weeks: readonly (readonly UsageCalendarCell[])[]
  readonly months: readonly { readonly week: number; readonly label: string }[]
  readonly maxTotal: number
}

/**
 * Arrange recorded Shanghai days into Sunday-first contribution weeks, from the
 * Sunday on or before the first activity through today.
 * @param snapshot - Aggregated usage for the selected period.
 * @param today - Today's Shanghai calendar day.
 * @param monthLabel - Formats a day's month name.
 * @returns Week columns, month markers, and the heaviest day total.
 */
export function buildUsageCalendar(
  snapshot: UsageSummary,
  today: string,
  monthLabel: (date: string) => string,
): UsageCalendarModel {
  const byDate = new Map(snapshot.days.map(day => [day.date, day]))
  const firstDay = snapshot.days[0]
  let start = firstDay === undefined
    ? today
    : snapshot.days.reduce((earliest, day) => minDay(earliest, day.date), firstDay.date)
  if (start > today) start = today
  start = shiftDay(start, -dayOfWeek(start))
  const end = shiftDay(today, 6 - dayOfWeek(today))
  const weeks: UsageCalendarCell[][] = []
  let week: UsageCalendarCell[] = []
  for (let date = start; date <= end; date = shiftDay(date, 1)) {
    const totals = byDate.get(date)
    week.push({ date, totals })
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  const months: { week: number; label: string }[] = []
  let previousMonth = ''
  weeks.forEach((cells, weekIndex) => {
    for (const cell of cells) {
      if (cell.date === null || cell.date.slice(0, 7) === previousMonth) continue
      previousMonth = cell.date.slice(0, 7)
      months.push({ week: weekIndex, label: monthLabel(cell.date) })
      break
    }
  })
  const maxTotal = snapshot.days.reduce((max, day) => Math.max(max, day.totalTokens), 0)
  return { weeks, months, maxTotal }
}

/** Map one day's total tokens onto the 0–4 intensity scale. */
export function usageDayLevel(totalTokens: number, maxTotal: number): 0 | 1 | 2 | 3 | 4 {
  if (maxTotal <= 0 || totalTokens <= 0) return 0
  const ratio = totalTokens / maxTotal
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return <span className={css.metric}><span>{label}</span><strong>{value}</strong></span>
}

/** Render one provider card's four actual token buckets. */
export function UsageCard({ title, totals, t, format }: {
  readonly title: string
  readonly totals: UsageTotals
  readonly t: UsageSectionProps['t']
  readonly format: (value: number) => string
}) {
  return (
    <article className={css.providerCard}>
      <div className={css.providerHead}><h4>{title}</h4><span>{t('requests', { count: format(totals.requests) })}</span></div>
      <strong className={css.total}>{format(totals.totalTokens)}</strong>
      <span className={css.totalLabel}>{t('totalTokens')}</span>
      <div className={css.metrics}>
        <Metric label={t('input')} value={format(totals.inputTokens)} />
        <Metric label={t('cached')} value={format(totals.cachedTokens)} />
        <Metric label={t('output')} value={format(totals.outputTokens)} />
      </div>
    </article>
  )
}

/** GitHub-style contribution grid over the recorded Shanghai days. */
export function UsageCalendar({ snapshot, t, format, formatDate, monthLabel, today }: {
  readonly snapshot: UsageSummary
  readonly t: UsageSectionProps['t']
  readonly format: (value: number) => string
  readonly formatDate: (value: string) => string
  readonly monthLabel: (value: string) => string
  readonly today: string
}) {
  const calendar = buildUsageCalendar(snapshot, today, monthLabel)
  const gridCells = calendar.weeks.flatMap(week => week.map(cell => cell))
  return (
    <div className={css.calendarWrap}>
      <div className={css.calendar} role="table" aria-label={t('title')}>
        <div className={css.calendarMonths} role="row">
          {calendar.months.map(month => (
            <span key={`${month.week}:${month.label}`} className={css.calendarMonth} style={{ gridColumnStart: month.week + 1 }}>{month.label}</span>
          ))}
        </div>
        <div className={css.calendarGrid} role="rowgroup">
          {gridCells.map((cell, index) => {
            if (cell.date === null) {
              return <span key={`pad-${index}`} className={css.calendarCell} data-empty="true" aria-hidden="true" />
            }
            const totals = cell.totals
            const level = totals === undefined ? 0 : usageDayLevel(totals.totalTokens, calendar.maxTotal)
            const description = totals === undefined
              ? `0 ${t('tokens')}`
              : t('dayTotal', { total: format(totals.totalTokens), requests: format(totals.requests) })
            return (
              <span
                key={cell.date}
                className={css.calendarCell}
                role="gridcell"
                data-level={level}
                data-testid={`usage-day-${cell.date}`}
                title={`${formatDate(cell.date)} — ${description}`}
                aria-label={`${formatDate(cell.date)} — ${description}`}
              />
            )
          })}
        </div>
      </div>
      <div className={css.legend}>
        <span>{t('legendLess')}</span>
        {[0, 1, 2, 3, 4].map(level => <span key={level} className={css.calendarCell} data-level={level} />)}
        <span>{t('legendMore')}</span>
      </div>
    </div>
  )
}

/** Render the usage Settings section. */
export function UsageSection({ summary, t }: UsageSectionProps) {
  const today = shanghaiDay(Date.now())
  const [date, setDate] = useState<string | undefined>(() => undefined)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  // The contribution calendar always reads the complete recorded history; the
  // date filter only picks which day's provider/model details to expand.
  const load = useCallback(() => summary({}), [summary])
  useEffect(() => {
    let current = true
    void load().then(
      (snapshot) => { if (current) setState({ status: 'ready', snapshot }) },
      () => { if (current) setState(previous => ({ status: 'error', ...'snapshot' in previous ? { snapshot: previous.snapshot } : {} })) },
    )
    return () => { current = false }
  }, [load, revision])

  const locale = t('locale')
  const format = (value: number): string => new Intl.NumberFormat(locale).format(value)
  const formatDate = (value: string): string => new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: 'short', day: 'numeric', weekday: 'short',
  }).format(new Date(`${value}T00:00:00.000Z`))
  const monthLabel = (value: string): string => new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Shanghai', month: 'short',
  }).format(new Date(`${value}T00:00:00.000Z`))
  const snapshot = state.snapshot
  const empty = snapshot !== undefined && snapshot.days.every(day => day.providers.every(provider => provider.models.length === 0))
  const selectedDay = date !== undefined && isDay(date) ? snapshot?.days.find(day => day.date === date) : undefined

  return (
    <section className={css.section} aria-busy={state.status === 'loading'}>
      <header className={css.header}>
        <div><h2 className={css.title}>{t('title')}</h2></div>
        <div className={css.filters}>
          <Input
            type="date"
            aria-label={t('date')}
            value={date ?? ''}
            max={today}
            onChange={(event) => {
              setDate(event.target.value === '' ? undefined : event.target.value)
            }}
          />
          <Button size="sm" variant="outline" disabled={date === undefined} onClick={() => {
            setDate(undefined)
          }}>{t('allHistory')}</Button>
          {date === undefined ? <Button size="sm" onClick={() => {
            setDate(today)
          }}>{t('today')}</Button> : null}
        </div>
      </header>

      {state.status === 'error' ? <div className={css.error} role="alert"><span>{t('loadFailed')}</span><Button size="sm" variant="outline" onClick={() => {
        setState({ status: 'loading', ...snapshot === undefined ? {} : { snapshot } })
        setRevision(value => value + 1)
      }}>{t('retry')}</Button></div> : null}
      {state.status === 'loading' && snapshot === undefined ? <div className={css.loading}><StateDot state="ongoing" size={24} /></div> : null}
      {snapshot?.incomplete === true ? <p className={css.warning}>{t('incomplete')}</p> : null}
      {snapshot !== undefined
        ? <UsageCalendar snapshot={snapshot} t={t} format={format} formatDate={formatDate} monthLabel={monthLabel} today={today} />
        : null}
      {state.status !== 'loading' && empty ? <div className={css.empty}><strong>{t('emptyTitle')}</strong><p>{t('emptyDescription')}</p></div> : null}
      {selectedDay !== undefined
        ? (
          <div className={css.day} key={selectedDay.date}>
            <div className={css.dayHead}><h3>{formatDate(selectedDay.date)}</h3><span>{t('totalTokens')}: {format(selectedDay.totalTokens)}</span></div>
            <div className={css.providers}>
              {selectedDay.providers.map(provider => (
                <UsageCard key={provider.id} title={t(provider.id)} totals={provider} t={t} format={format} />
              ))}
            </div>
            <div className={css.tableWrap}>
              <table>
                <thead><tr><th>{t('model')}</th><th>{t('input')}</th><th>{t('cached')}</th><th>{t('output')}</th><th>{t('totalTokens')}</th></tr></thead>
                <tbody>{selectedDay.providers.flatMap(provider => provider.models.map(model => (
                  <tr key={`${model.provider}${model.model}`}>
                    <th scope="row"><span>{model.model}</span><small>{model.provider}</small></th>
                    <td>{format(model.inputTokens)}</td><td>{format(model.cachedTokens)}</td>
                    <td>{format(model.outputTokens)}</td><td>{format(model.totalTokens)}</td>
                  </tr>
                )))}</tbody>
              </table>
            </div>
          </div>
        )
        : null}
    </section>
  )
}
