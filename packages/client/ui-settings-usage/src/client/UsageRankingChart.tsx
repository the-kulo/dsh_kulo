/**
 * Ranked horizontal bars of request counts per model.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/UsageRankingChart
 */

import { useMemo } from 'react'
import type { UsageDaySummary } from '../types.ts'
import { aggregateModels } from './usageAggregate.ts'
import type { AggregatedModel } from './usageAggregate.ts'
import { modelLabel } from './chartShared.ts'
import type { UsageTranslate } from './chartShared.ts'
import css from './UsageSection.module.css'

const TOP_N = 12

/** Props for the request-count ranking chart. */
export interface UsageRankingChartProps {
  readonly days: readonly UsageDaySummary[]
  readonly t: UsageTranslate
  readonly formatCompact: Intl.NumberFormat
}

/** Render one label-plus-bar row per model, largest first. */
export function UsageRankingChart({ days, t, formatCompact }: UsageRankingChartProps): React.ReactElement {
  const ranked = useMemo(() => {
    const aggregated: AggregatedModel[] = aggregateModels(days)
    return aggregated
      .filter(model => model.requests > 0)
      .sort((left, right) => right.requests - left.requests)
      .slice(0, TOP_N)
  }, [days])

  if (ranked.length === 0) {
    return <div className={css.chartBody}><div className={css.trendEmpty}>{t('noData')}</div></div>
  }

  const maxValue = ranked[0]!.requests

  return (
    <div className={css.chartBody}>
      <ol className={css.rankList}>
        {ranked.map(model => {
          const key = `${model.provider}/${model.model}`
          return (
            <li key={key} className={css.rankRow}>
              <span className={css.rankName} title={key}>{modelLabel(key)}</span>
              <span className={css.rankBarTrack}>
                <span className={css.rankBarFill}
                  style={{ width: `${Math.max((model.requests / maxValue) * 100, 1)}%` }} />
              </span>
              <span className={css.rankValue}>{formatCompact.format(model.requests)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
