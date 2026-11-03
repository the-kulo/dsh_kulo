/**
 * Top-row KPI cards for the selected range.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/UsageSummaryCard
 */

import type { UsageSectionProps } from './UsageSection.tsx'
import type { UsageTotals } from '../types.ts'
import { cacheHitRate } from './usageAggregate.ts'
import css from './UsageSection.module.css'

/** Props for the KPI card row. */
export interface UsageSummaryCardProps {
  readonly totals: UsageTotals
  readonly t: UsageSectionProps['t']
  readonly format: (value: number) => string
  readonly formatPercent: (value: number) => string
}

/** Four KPI cards: input tokens, output tokens, cached tokens, and the overall cache hit rate. */
export function UsageSummaryCard({ totals, t, format, formatPercent }: UsageSummaryCardProps): React.ReactElement {
  const hit = cacheHitRate(totals)
  const hitText = hit === undefined ? t('cacheHitDash') : formatPercent(hit)
  const consumed = totals.inputTokens + totals.cachedTokens + totals.outputTokens
  const hitHint = consumed > 0
    ? t('shareOfConsumed', { share: formatPercent(totals.cachedTokens / consumed) })
    : t('cacheHitDash')
  return (
    <div className={css.kpiGrid}>
      <KpiCard label={t('kpiInputTokens')} value={format(totals.inputTokens)} hint={t('inputHint')} />
      <KpiCard label={t('kpiOutputTokens')} value={format(totals.outputTokens)} hint={t('tokens')} />
      <KpiCard label={t('kpiCachedTokens')} value={format(totals.cachedTokens)} hint={t('tokens')} />
      <KpiCard label={t('kpiCacheHitRate')} value={hitText} hint={hitHint} accent />
    </div>
  )
}

function KpiCard({ label, value, hint, accent }: {
  readonly label: string
  readonly value: string
  readonly hint: string
  readonly accent?: boolean
}): React.ReactElement {
  return (
    <article className={accent === true ? `${css.kpiCard} ${css.kpiCardAccent}` : css.kpiCard}>
      <span className={css.kpiLabel}>{label}</span>
      <strong className={accent === true ? `${css.kpiValue} ${css.kpiValueAccent}` : css.kpiValue}>{value}</strong>
      <span className={css.kpiHint}>{hint}</span>
    </article>
  )
}
