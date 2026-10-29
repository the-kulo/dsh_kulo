/**
 * Tabbed detail tables: per-day, per-provider, and per-model breakdowns.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/UsageDetailTabs
 */

import { useState } from 'react'
import type { UsageSectionProps } from './UsageSection.tsx'
import type { UsageDaySummary } from '../types.ts'
import {
  aggregateModels, aggregateProviders, cacheHitRate, type AggregatedModel, type AggregatedProvider,
} from './usageAggregate.ts'
import css from './UsageSection.module.css'

type DetailTab = 'daily' | 'provider' | 'model'

/** Props for the detail tabs. */
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
      <div className={css.detailTabs} role="tablist">
        <DetailTabButton active={tab === 'daily'} onClick={() => { setTab('daily') }}>{t('tabDaily')}</DetailTabButton>
        <DetailTabButton active={tab === 'provider'} onClick={() => { setTab('provider') }}>{t('tabProvider')}</DetailTabButton>
        <DetailTabButton active={tab === 'model'} onClick={() => { setTab('model') }}>{t('tabModel')}</DetailTabButton>
      </div>
      <div className={css.tableWrap}>
        {tab === 'daily' ? <DailyTable days={days} t={t} format={format} formatDate={formatDate} formatPercent={formatPercent} /> : null}
        {tab === 'provider' ? <ProviderTable providers={providers} t={t} format={format} formatPercent={formatPercent} /> : null}
        {tab === 'model' ? <ModelTable models={models} t={t} format={format} formatPercent={formatPercent} /> : null}
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
    <table>
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
  )
}

function ProviderTable({ providers, t, format, formatPercent }: {
  readonly providers: readonly AggregatedProvider[]
  readonly t: UsageDetailTabsProps['t']
  readonly format: (value: number) => string
  readonly formatPercent: (value: number) => string
}): React.ReactElement {
  if (providers.length === 0) return <div className={css.detailEmpty}>{t('noData')}</div>
  return (
    <table>
      <thead>
        <tr>
          <th>{t('provider')}</th>
          <th>{t('requests')}</th>
          <th>{t('input')}</th>
          <th>{t('cached')}</th>
          <th>{t('output')}</th>
          <th>{t('totalTokens')}</th>
          <th>{t('cacheHit')}</th>
        </tr>
      </thead>
      <tbody>
        {providers.map(provider => {
          const hit = cacheHitRate(provider)
          return (
            <tr key={provider.id}>
              <th scope="row">{t(provider.id)}</th>
              <td>{format(provider.requests)}</td>
              <td>{format(provider.inputTokens)}</td>
              <td>{format(provider.cachedTokens)}</td>
              <td>{format(provider.outputTokens)}</td>
              <td>{format(provider.totalTokens)}</td>
              <td>{hit === undefined ? t('cacheHitDash') : formatPercent(hit)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ModelTable({ models, t, format, formatPercent }: {
  readonly models: readonly AggregatedModel[]
  readonly t: UsageDetailTabsProps['t']
  readonly format: (value: number) => string
  readonly formatPercent: (value: number) => string
}): React.ReactElement {
  if (models.length === 0) return <div className={css.detailEmpty}>{t('noData')}</div>
  return (
    <table>
      <thead>
        <tr>
          <th>{t('model')}</th>
          <th>{t('requests')}</th>
          <th>{t('input')}</th>
          <th>{t('cached')}</th>
          <th>{t('output')}</th>
          <th>{t('totalTokens')}</th>
          <th>{t('cacheHit')}</th>
        </tr>
      </thead>
      <tbody>
        {models.map(model => {
          const hit = cacheHitRate(model)
          return (
            <tr key={`${model.provider}/${model.model}`}>
              <th scope="row">
                <span>{model.model}</span>
                <small>{model.provider}</small>
              </th>
              <td>{format(model.requests)}</td>
              <td>{format(model.inputTokens)}</td>
              <td>{format(model.cachedTokens)}</td>
              <td>{format(model.outputTokens)}</td>
              <td>{format(model.totalTokens)}</td>
              <td>{hit === undefined ? t('cacheHitDash') : formatPercent(hit)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
