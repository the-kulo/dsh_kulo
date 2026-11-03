/**
 * Settings dashboard for provider-reported token usage.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/UsageSection
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button, IconGaugeOutlineRegular, IconInfoOutlineRegular, IconWarningTriangleOutlineRegular, StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { UsageSummary, UsageSummaryRequest } from '../types.ts'
import { shanghaiDay } from '../usage.ts'
import {
  filterDays, resolveRange, sumDays, type UsageRangePreset,
} from './usageAggregate.ts'
import { UsageSummaryCard } from './UsageSummaryCard.tsx'
import { UsageTimeRange } from './UsageTimeRange.tsx'
import { UsageTrendChart } from './UsageTrendChart.tsx'
import { UsageDetailTabs } from './UsageDetailTabs.tsx'
import { UsageCalendar, UsageCard } from './UsageCalendar.tsx'
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

function isDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
}

/** Centered light empty/loading/error surface: an icon plus one line of copy. */
function StateBlock({ icon, children }: { readonly icon: React.ReactNode; readonly children: React.ReactNode }): React.ReactElement {
  return (
    <div className={css.stateBlock}>
      <span className={css.stateIcon}>{icon}</span>
      <div className={css.stateBody}>{children}</div>
    </div>
  )
}

/** Render the usage Settings section. */
export function UsageSection({ summary, t }: UsageSectionProps): React.ReactElement {
  const today = shanghaiDay(Date.now())
  const [preset, setPreset] = useState<UsageRangePreset>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  // The contribution calendar always reads the complete recorded history; the
  // time-range filter only scopes the summary card, trend chart, and detail tabs.
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
  const format = useCallback((value: number): string => new Intl.NumberFormat(locale).format(value), [locale])
  const formatPercent = useCallback((value: number): string =>
    new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value), [locale])
  const formatDate = useCallback((value: string): string =>
    new Intl.DateTimeFormat(locale, {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: 'short', day: 'numeric', weekday: 'short',
    }).format(new Date(`${value}T00:00:00.000Z`)), [locale])
  const formatAxisDate = useCallback((value: string): string =>
    new Intl.DateTimeFormat(locale, {
      timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric',
    }).format(new Date(`${value}T00:00:00.000Z`)), [locale])
  const monthLabel = useCallback((value: string): string =>
    new Intl.DateTimeFormat(locale, {
      timeZone: 'Asia/Shanghai', month: 'short',
    }).format(new Date(`${value}T00:00:00.000Z`)), [locale])

  const snapshot = state.snapshot
  const empty = snapshot !== undefined
    && snapshot.days.every(day => day.providers.every(provider => provider.models.length === 0))

  const range = useMemo(
    () => resolveRange(today, preset, customFrom || undefined, customTo || undefined),
    [today, preset, customFrom, customTo],
  )
  const scopedDays = useMemo(
    () => snapshot !== undefined ? filterDays(snapshot.days, range) : [],
    [snapshot, range],
  )
  const rangeTotals = useMemo(() => sumDays(scopedDays), [scopedDays])

  const selectedDay = selectedDate !== undefined && isDay(selectedDate)
    ? snapshot?.days.find(day => day.date === selectedDate)
    : undefined

  function handleRangeChange(nextPreset: UsageRangePreset, from?: string, to?: string): void {
    setPreset(nextPreset)
    setCustomFrom(from ?? '')
    setCustomTo(to ?? '')
  }

  function retry(): void {
    setState({ status: 'loading', ...snapshot === undefined ? {} : { snapshot } })
    setRevision(value => value + 1)
  }

  return (
    <section className={css.section} aria-busy={state.status === 'loading'}>
      <header className={css.header}>
        <div><h2 className={css.title}>{t('title')}</h2></div>
      </header>

      <UsageTimeRange
        preset={preset}
        customFrom={customFrom}
        customTo={customTo}
        today={today}
        t={t}
        onChange={handleRangeChange}
      />

      {state.status === 'error'
        ? (snapshot === undefined
          ? (
            <StateBlock icon={<IconWarningTriangleOutlineRegular size={22} className={css.stateIconError} />}>
              <p className={css.stateText}>{t('loadFailed')}</p>
              <Button size="sm" variant="outline" onClick={retry}>{t('retry')}</Button>
            </StateBlock>
          )
          : (
            <div className={`${css.banner} ${css.bannerError}`} role="alert">
              <IconWarningTriangleOutlineRegular size={16} className={css.bannerIcon} />
              <span className={css.bannerText}>{t('loadFailed')}</span>
              <Button size="sm" variant="outline" onClick={retry}>{t('retry')}</Button>
            </div>
          ))
        : null}
      {state.status === 'loading' && snapshot === undefined
        ? (
          <StateBlock icon={<StateDot state="ongoing" size={20} />}>
            <p className={css.stateText}>{t('loading')}</p>
          </StateBlock>
        )
        : null}
      {snapshot?.incomplete === true
        ? (
          <div className={`${css.banner} ${css.bannerWarn}`}>
            <IconInfoOutlineRegular size={16} className={css.bannerIcon} />
            <span className={css.bannerText}>{t('incomplete')}</span>
          </div>
        )
        : null}

      {snapshot !== undefined && !empty
        ? (
          <>
            <UsageSummaryCard totals={rangeTotals} t={t} format={format} formatPercent={formatPercent} />
            <UsageTrendChart days={scopedDays} t={t} format={format} formatDate={formatDate} formatAxisDate={formatAxisDate} />
            <UsageDetailTabs days={scopedDays} t={t} format={format} formatDate={formatDate} formatPercent={formatPercent} />
            <div className={css.activitySection}>
              <h3 className={css.sectionHeading}>{t('activity')}</h3>
              <UsageCalendar
                snapshot={snapshot}
                t={t}
                format={format}
                formatDate={formatDate}
                monthLabel={monthLabel}
                today={today}
                selectedDate={selectedDate}
                onSelectDate={(date) => { setSelectedDate(date === selectedDate ? undefined : date) }}
              />
            </div>
          </>
        )
        : null}

      {state.status !== 'loading' && empty
        ? (
          <StateBlock icon={<IconGaugeOutlineRegular size={22} />}>
            <strong className={css.stateTitle}>{t('emptyTitle')}</strong>
            <p className={css.stateText}>{t('emptyDescription')}</p>
          </StateBlock>
        )
        : null}

      {selectedDay !== undefined
        ? (
          <div className={css.day} key={selectedDay.date}>
            <div className={css.dayHead}>
              <h3>{formatDate(selectedDay.date)}</h3>
              <Button size="sm" variant="outline" onClick={() => { setSelectedDate(undefined) }}>{t('allHistory')}</Button>
            </div>
            <div className={css.providers}>
              {selectedDay.providers.map(provider => (
                <UsageCard key={provider.id} title={t(provider.id)} totals={provider} t={t} format={format} />
              ))}
            </div>
            <div className={css.tableWrap}>
              <table className={css.table}>
                <thead>
                  <tr>
                    <th>{t('model')}</th>
                    <th>{t('input')}</th>
                    <th>{t('cached')}</th>
                    <th>{t('output')}</th>
                    <th>{t('totalTokens')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDay.providers.flatMap(provider => provider.models.map(model => (
                    <tr key={`${model.provider}${model.model}`}>
                      <th scope="row"><span>{model.model}</span><small>{model.provider}</small></th>
                      <td>{format(model.inputTokens)}</td>
                      <td>{format(model.cachedTokens)}</td>
                      <td>{format(model.outputTokens)}</td>
                      <td>{format(model.totalTokens)}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
        )
        : null}
    </section>
  )
}
