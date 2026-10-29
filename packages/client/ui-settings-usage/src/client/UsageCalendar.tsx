/**
 * GitHub-style contribution heatmap calendar for usage days.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/UsageCalendar
 */

import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { UsageSummary } from '../types.ts'
import type { UsageSectionProps } from './UsageSection.tsx'
import css from './UsageSection.module.css'

/** One calendar cell: a Shanghai day, or null for a week-start pad slot. */
export interface UsageCalendarCell {
  readonly date: string | null
  readonly totals: UsageSummary['days'][number] | undefined
}

export interface UsageCalendarModel {
  readonly weeks: readonly (readonly UsageCalendarCell[])[]
  readonly months: readonly { readonly week: number; readonly label: string }[]
  readonly maxTotal: number
}

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

/** Props for the contribution calendar heatmap. */
export interface UsageCalendarProps {
  readonly snapshot: UsageSummary
  readonly t: PropsLocale<'settings.usage'>['t']
  readonly format: (value: number) => string
  readonly formatDate: (value: string) => string
  readonly monthLabel: (value: string) => string
  readonly today: string
  readonly selectedDate?: string | undefined
  readonly onSelectDate?: (date: string) => void
}

/** GitHub-style contribution grid over the recorded Shanghai days. */
export function UsageCalendar({
  snapshot, t, format, formatDate, monthLabel, today, selectedDate, onSelectDate,
}: UsageCalendarProps): React.ReactElement {
  const calendar = buildUsageCalendar(snapshot, today, monthLabel)
  const gridCells = calendar.weeks.flatMap(week => week.map(cell => cell))
  return (
    <div className={css.calendarWrap}>
      <div className={css.calendar} role="table" aria-label={t('activity')}>
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
            const isSelected = selectedDate === cell.date
            return (
              <span
                key={cell.date}
                className={css.calendarCell}
                role="gridcell"
                data-level={level}
                data-selected={isSelected ? 'true' : undefined}
                data-testid={`usage-day-${cell.date}`}
                title={`${formatDate(cell.date)} — ${description}`}
                aria-label={`${formatDate(cell.date)} — ${description}`}
                onClick={onSelectDate === undefined ? undefined : () => { onSelectDate(cell.date!) }}
                style={onSelectDate === undefined ? undefined : { cursor: 'pointer' }}
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

/** Render one provider card's four actual token buckets. */
export function UsageCard({ title, totals, t, format }: {
  readonly title: string
  readonly totals: UsageSummary['days'][number]['providers'][number]
  readonly t: UsageSectionProps['t']
  readonly format: (value: number) => string
}): React.ReactElement {
  return (
    <article className={css.providerCard}>
      <div className={css.providerHead}>
        <h4>{title}</h4>
        <span>{t('requests', { count: format(totals.requests) })}</span>
      </div>
      <strong className={css.total}>{format(totals.totalTokens)}</strong>
      <span className={css.totalLabel}>{t('totalTokens')}</span>
      <div className={css.metrics}>
        <UsageMetric label={t('input')} value={format(totals.inputTokens)} />
        <UsageMetric label={t('cached')} value={format(totals.cachedTokens)} />
        <UsageMetric label={t('output')} value={format(totals.outputTokens)} />
      </div>
    </article>
  )
}

function UsageMetric({ label, value }: { readonly label: string; readonly value: string }): React.ReactElement {
  return <span className={css.metric}><span>{label}</span><strong>{value}</strong></span>
}
