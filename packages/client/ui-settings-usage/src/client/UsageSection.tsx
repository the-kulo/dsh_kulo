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
  collectModelKeys, filterDays, filterDaysByModels, resolveRange, sumDays,
  type UsageRangePreset,
} from './usageAggregate.ts'
import type { UsageLocaleKey } from './locales.ts'
import { UsageSummaryCard } from './UsageSummaryCard.tsx'
import { UsageTimeRange } from './UsageTimeRange.tsx'
import { UsageTrendChart } from './UsageTrendChart.tsx'
import { UsageConsumptionChart } from './UsageConsumptionChart.tsx'
import { UsageRequestsChart } from './UsageRequestsChart.tsx'
import { UsageRankingChart } from './UsageRankingChart.tsx'
import { UsageCacheTable } from './UsageCacheTable.tsx'
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

type UsageTab = 'consumption' | 'trend' | 'requests' | 'rank' | 'cache'

/** Filter values the query button commits to every chart and table. */
interface UsageFilters {
  readonly preset: UsageRangePreset
  readonly customFrom: string
  readonly customTo: string
  readonly models: ReadonlySet<string>
}

const TABS: readonly { readonly id: UsageTab; readonly labelKey: UsageLocaleKey }[] = [
  { id: 'consumption', labelKey: 'tabConsumption' },
  { id: 'trend', labelKey: 'tabTrend' },
  { id: 'requests', labelKey: 'tabRequestDist' },
  { id: 'rank', labelKey: 'tabRequestRank' },
  { id: 'cache', labelKey: 'tabCacheAnalysis' },
]

const NO_MODELS: ReadonlySet<string> = new Set<string>()

const INITIAL_FILTERS: UsageFilters = {
  preset: '30d', customFrom: '', customTo: '', models: NO_MODELS,
}

/** Centered light empty/loading/error surface: an icon plus one line of copy. */
function StateBlock({ icon, children }: {
  readonly icon: React.ReactNode
  readonly children: React.ReactNode
}): React.ReactElement {
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
  const [draft, setDraft] = useState<UsageFilters>(INITIAL_FILTERS)
  const [applied, setApplied] = useState<UsageFilters>(INITIAL_FILTERS)
  const [tab, setTab] = useState<UsageTab>('consumption')
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<LoadState>({ status: 'loading' })

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
  const formatCompact = useMemo(() =>
    new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }), [locale])
  const formatDate = useCallback((value: string): string =>
    new Intl.DateTimeFormat(locale, {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: 'short', day: 'numeric', weekday: 'short',
    }).format(new Date(`${value}T00:00:00.000Z`)), [locale])
  const formatAxisDate = useCallback((value: string): string =>
    value.includes('W')
      ? t('weekLabel', { week: value.slice(value.indexOf('W') + 1) })
      : new Intl.DateTimeFormat(locale, {
        timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric',
      }).format(new Date(`${value}T00:00:00.000Z`)), [locale, t])

  const snapshot = state.snapshot
  const empty = snapshot !== undefined
    && snapshot.days.every(day => day.providers.every(provider => provider.models.length === 0))

  const allModels = useMemo(
    () => snapshot === undefined ? [] : collectModelKeys(snapshot.days),
    [snapshot],
  )

  const range = useMemo(
    () => resolveRange(today, applied.preset, applied.customFrom || undefined, applied.customTo || undefined),
    [today, applied],
  )
  const scopedDays = useMemo(
    () => snapshot === undefined
      ? []
      : filterDaysByModels(filterDays(snapshot.days, range), applied.models),
    [snapshot, range, applied.models],
  )
  const totals = useMemo(() => sumDays(scopedDays), [scopedDays])
  // Bucketing follows the data volume the range actually holds: long histories
  // grow unreadable as daily bars, while short ones do not need weekly grouping.
  const granularity: 'day' | 'week' = scopedDays.length > 60 ? 'week' : 'day'

  const formatRowTime = useCallback(
    (period: string, date?: string): string => formatAxisDate(date ?? period),
    [formatAxisDate],
  )

  function handleRangeChange(preset: UsageRangePreset, from?: string, to?: string): void {
    setDraft(previous => ({ ...previous, preset, customFrom: from ?? '', customTo: to ?? '' }))
  }

  function handleQuery(): void {
    setApplied(draft)
    setRevision(value => value + 1)
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
        preset={draft.preset}
        customFrom={draft.customFrom}
        customTo={draft.customTo}
        today={today}
        t={t}
        onChange={handleRangeChange}
        selectedModels={draft.models}
        allModels={allModels}
        onModelsChange={(models) => { setDraft(previous => ({ ...previous, models })) }}
        onQuery={handleQuery}
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
            <UsageSummaryCard totals={totals} t={t} format={format} formatPercent={formatPercent} />
            <div className={css.panel}>
              <div className={css.detailTabs} role="tablist" aria-label={t('title')}>
                {TABS.map(entry => (
                  <button
                    key={entry.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === entry.id}
                    className={css.detailTab}
                    data-active={tab === entry.id ? 'true' : undefined}
                    onClick={() => { setTab(entry.id) }}
                  >
                    {t(entry.labelKey)}
                  </button>
                ))}
              </div>
              <div className={css.panelBody}>
                {tab === 'consumption'
                  ? (
                    <UsageConsumptionChart
                      days={scopedDays}
                      granularity={granularity}
                      t={t}
                      formatCompact={formatCompact}
                      formatAxisDate={formatAxisDate}
                    />
                  )
                  : null}
                {tab === 'trend'
                  ? (
                    <UsageTrendChart
                      days={scopedDays}
                      granularity={granularity}
                      t={t}
                      format={format}
                      formatDate={formatDate}
                      formatAxisDate={formatAxisDate}
                    />
                  )
                  : null}
                {tab === 'requests'
                  ? (
                    <UsageRequestsChart
                      days={scopedDays}
                      t={t}
                      format={format}
                      formatPercent={formatPercent}
                    />
                  )
                  : null}
                {tab === 'rank'
                  ? <UsageRankingChart days={scopedDays} t={t} formatCompact={formatCompact} />
                  : null}
                {tab === 'cache'
                  ? (
                    <UsageCacheTable
                      days={scopedDays}
                      granularity={granularity}
                      t={t}
                      format={format}
                      formatPercent={formatPercent}
                      formatRowTime={formatRowTime}
                    />
                  )
                  : null}
              </div>
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
    </section>
  )
}
