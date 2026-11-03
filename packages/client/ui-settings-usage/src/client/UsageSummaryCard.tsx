/**
 * Top-row KPI cards for the selected range.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/UsageSummaryCard
 */

import type { UsageSectionProps } from './UsageSection.tsx'
import type { UsageTotals } from '../types.ts'
import { cacheHitRate, consumedTokens } from './usageAggregate.ts'
import css from './UsageSection.module.css'

/** Props for the KPI card row. */
export interface UsageSummaryCardProps {
  readonly totals: UsageTotals
  readonly t: UsageSectionProps['t']
  readonly format: (value: number) => string
  readonly formatPercent: (value: number) => string
}

/** Four KPI cards: requests, input, output, and cache hit rate. */
export function UsageSummaryCard({ totals, t, format, formatPercent }: UsageSummaryCardProps): React.ReactElement {
  const hit = cacheHitRate(totals)
  const hitText = hit === undefined ? t('cacheHitDash') : formatPercent(hit)
  const consumed = consumedTokens(totals)
  const outputShare = consumed > 0 ? totals.outputTokens / consumed : 0
  return (
    <div className={css.kpiGrid}>
      <KpiCard
        label={t('metricRequests')}
        value={format(totals.requests)}
        hint={`${format(totals.totalTokens)} ${t('tokens')}`}
      />
      <KpiCard
        label={t('input')}
        value={format(totals.inputTokens)}
        hint={t('inputHint')}
      />
      <KpiCard
        label={t('output')}
        value={format(totals.outputTokens)}
        hint={t('shareOfConsumed', { share: formatPercent(outputShare) })}
      />
      <KpiCard
        label={t('metricCacheHit')}
        value={hitText}
        hint={`${format(totals.cachedTokens)} ${t('tokens')}`}
      />
    </div>
  )
}

function KpiCard({ label, value, hint }: {
  readonly label: string
  readonly value: string
  readonly hint: string
}): React.ReactElement {
  return (
    <article className={css.kpiCard}>
      <span className={css.kpiLabel}>{label}</span>
      <strong className={css.kpiValue}>{value}</strong>
      <span className={css.kpiHint}>{hint}</span>
    </article>
  )
}
