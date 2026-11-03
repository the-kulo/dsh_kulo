/**
 * Detail card: request-detail table plus provider/model breakdown lists with
 * share bars.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/UsageDetailTabs
 */

import { useState } from 'react'
import type { UsageSectionProps } from './UsageSection.tsx'
import type { UsageDaySummary, UsageTotals } from '../types.ts'
import {
  aggregateModels, aggregateProviders, cacheHitRate, type AggregatedModel, type AggregatedProvider,
} from './usageAggregate.ts'
import css from './UsageSection.module.css'

type DetailTab = 'daily' | 'provider' | 'model'

/** Props for the detail card. */
export interface UsageDetailTabsProps {
  readonly days: readonly UsageDaySummary[]
  readonly t: UsageSectionProps['t']
  readonly format: (value: number) => string
  readonly formatDate: (value: string) => string
  readonly formatPercent: (value: number) => string
}

/** Tabbed detail view: request details (by day), provider breakdown, model breakdown. */
export function UsageDetailTabs({ days, t, format, formatDate, formatPercent }: UsageDetailTabsProps): React.ReactElement {
  const [tab, setTab] = useState<DetailTab>('daily')
  const providers = aggregateProviders(days)
  const models = aggregateModels(days)
  return (
    <div className={css.detailWrap}>
      <div className={css.detailTabs} role="tablist" aria-label={t('details')}>
        <DetailTabButton active={tab === 'daily'} onClick={() => { setTab('daily') }}>{t('tabDaily')}</DetailTabButton>
        <DetailTabButton active={tab === 'provider'} onClick={() => { setTab('provider') }}>{t('tabProvider')}</DetailTabButton>
        <DetailTabButton active={tab === 'model'} onClick={() => { setTab('model') }}>{t('tabModel')}</DetailTabButton>
      </div>
      <div className={css.detailBody}>
        {tab === 'daily' ? <DailyTable days={days} t={t} format={format} formatDate={formatDate} formatPercent={formatPercent} /> : null}
        {tab === 'provider' ? <ProviderBreakdown providers={providers} t={t} format={format} formatPercent={formatPercent} /> : null}
        {tab === 'model' ? <ModelBreakdown models={models} t={t} format={format} formatPercent={formatPercent} /> : null}
      </div>
    </div>
  )
}

function DetailTabButton({ active, onClick, children }: {
  readonly active: boolean
  readonly onClick: () => void
  readonly children: React.ReactNode
}): React.ReactElement {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={css.detailTab}
      data-active={active ? 'true' : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function DailyTable({ days, t, format, formatDate, formatPercent }: {
  readonly days: readonly UsageDaySummary[]
  readonly t: UsageDetailTabsProps['t']
  readonly format: (value: number) => string
  readonly formatDate: (value: string) => string
  readonly formatPercent: (value: number) => string
}): React.ReactElement {
  if (days.length === 0) return <div className={css.detailEmpty}>{t('noData')}</div>
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className={css.tableWrap}>
      <table className={css.table}>
        <thead>
          <tr>
            <th>{t('date')}</th>
            <th>{t('requests')}</th>
            <th>{t('input')}</th>
            <th>{t('cached')}</th>
            <th>{t('output')}</th>
            <th>{t('totalTokens')}</th>
            <th>{t('cacheHit')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(day => {
            const hit = cacheHitRate(day)
            return (
              <tr key={day.date}>
                <th scope="row">{formatDate(day.date)}</th>
                <td>{format(day.requests)}</td>
                <td>{format(day.inputTokens)}</td>
                <td>{format(day.cachedTokens)}</td>
                <td>{format(day.outputTokens)}</td>
                <td>{format(day.totalTokens)}</td>
                <td>{hit === undefined ? t('cacheHitDash') : formatPercent(hit)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ProviderBreakdown({ providers, t, format, formatPercent }: {
  readonly providers: readonly AggregatedProvider[]
  readonly t: UsageDetailTabsProps['t']
  readonly format: (value: number) => string
  readonly formatPercent: (value: number) => string
}): React.ReactElement {
  if (providers.length === 0) return <div className={css.detailEmpty}>{t('noData')}</div>
  const total = providers.reduce((sum, provider) => sum + provider.totalTokens, 0)
  return (
    <div className={css.breakdownList}>
      {providers.map(provider => (
        <BreakdownRow
          key={provider.id}
          title={t(provider.id)}
          totals={provider}
          share={total > 0 ? provider.totalTokens / total : 0}
          t={t}
          format={format}
          formatPercent={formatPercent}
        />
      ))}
    </div>
  )
}

function ModelBreakdown({ models, t, format, formatPercent }: {
  readonly models: readonly AggregatedModel[]
  readonly t: UsageDetailTabsProps['t']
  readonly format: (value: number) => string
  readonly formatPercent: (value: number) => string
}): React.ReactElement {
  if (models.length === 0) return <div className={css.detailEmpty}>{t('noData')}</div>
  const total = models.reduce((sum, model) => sum + model.totalTokens, 0)
  return (
    <div className={css.breakdownList}>
      {models.map(model => (
        <BreakdownRow
          key={`${model.provider}/${model.model}`}
          title={model.model}
          subtitle={model.provider}
          totals={model}
          share={total > 0 ? model.totalTokens / total : 0}
          t={t}
          format={format}
          formatPercent={formatPercent}
        />
      ))}
    </div>
  )
}

function BreakdownRow({ title, subtitle, totals, share, t, format, formatPercent }: {
  readonly title: string
  readonly subtitle?: string
  readonly totals: UsageTotals
  readonly share: number
  readonly t: UsageDetailTabsProps['t']
  readonly format: (value: number) => string
  readonly formatPercent: (value: number) => string
}): React.ReactElement {
  return (
    <article className={css.breakdownRow}>
      <div className={css.breakdownHead}>
        <div className={css.breakdownIdentity}>
          <strong className={css.breakdownName}>{title}</strong>
          {subtitle !== undefined ? <span className={css.breakdownSub}>{subtitle}</span> : null}
        </div>
        <div className={css.breakdownStats}>
          <span className={css.breakdownMeta}>{t('requests', { count: format(totals.requests) })}</span>
          <span className={css.breakdownMeta}>{format(totals.totalTokens)} <span className={css.breakdownMetaUnit}>{t('tokens')}</span></span>
        </div>
      </div>
      <div className={css.breakdownMeter}>
        <span className={css.breakdownBar}>
          <span className={css.breakdownBarFill} style={{ width: `${share * 100}%` }} />
        </span>
        <span className={css.breakdownShare}>{formatPercent(share)}</span>
      </div>
    </article>
  )
}
