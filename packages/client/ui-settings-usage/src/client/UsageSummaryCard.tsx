/**
 * Top-level summary metrics card with an expandable breakdown.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/UsageSummaryCard
 */

import { useState } from 'react'
import type { UsageSectionProps } from './UsageSection.tsx'
import type { UsageTotals } from '../types.ts'
import { cacheHitRate, consumedTokens } from './usageAggregate.ts'
import css from './UsageSection.module.css'

/** Props for the summary card. */
export interface UsageSummaryCardProps {
  readonly totals: UsageTotals
  readonly t: UsageSectionProps['t']
  readonly format: (value: number) => string
  readonly formatPercent: (value: number) => string
}

/** Top summary card: total requests, consumed tokens, cache hit rate; expandable breakdown. */
export function UsageSummaryCard({ totals, t, format, formatPercent }: UsageSummaryCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false)
  const hit = cacheHitRate(totals)
  const hitText = hit === undefined ? t('cacheHitDash') : formatPercent(hit)
  return (
    <div className={css.summaryCard}>
      <div className={css.summaryGrid}>
        <SummaryItem label={t('metricRequests')} value={format(totals.requests)} />
        <SummaryItem label={t('metricConsumed')} value={format(consumedTokens(totals))} hint={t('consumedHint')} />
        <SummaryItem label={t('metricCacheHit')} value={hitText} />
      </div>
      <button
        type="button"
        className={css.summaryToggle}
        onClick={() => { setExpanded(value => !value) }}
        aria-expanded={expanded}
      >
        {expanded ? t('lessMetrics') : t('moreMetrics')}
      </button>
      {expanded
        ? (
          <div className={css.summaryBreakdown}>
            <SummaryItem label={t('input')} value={format(totals.inputTokens)} />
            <SummaryItem label={t('cached')} value={format(totals.cachedTokens)} />
            <SummaryItem label={t('output')} value={format(totals.outputTokens)} />
            <SummaryItem label={t('totalTokens')} value={format(totals.totalTokens)} />
          </div>
        )
        : null}
    </div>
  )
}

function SummaryItem({ label, value, hint }: {
  readonly label: string
  readonly value: string
  readonly hint?: string | undefined
}): React.ReactElement {
  return (
    <div className={css.summaryItem}>
      <span className={css.summaryLabel}>{label}</span>
      <strong className={css.summaryValue}>{value}</strong>
      {hint !== undefined ? <span className={css.summaryHint}>{hint}</span> : null}
    </div>
  )
}
