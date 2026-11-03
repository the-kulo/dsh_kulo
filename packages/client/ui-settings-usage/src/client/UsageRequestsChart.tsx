/**
 * Donut chart of request-count share per model.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/UsageRequestsChart
 */

import { useMemo } from 'react'
import type { UsageDaySummary } from '../types.ts'
import { aggregateModels } from './usageAggregate.ts'
import { LINE_COLORS, MAX_SERIES, modelLabel } from './chartShared.ts'
import type { UsageTranslate } from './chartShared.ts'
import css from './UsageSection.module.css'

const SIZE = 260
const RADIUS = 96
const THICKNESS = 34
const CENTER = SIZE / 2

/** Props for the request-count distribution chart. */
export interface UsageRequestsChartProps {
  readonly days: readonly UsageDaySummary[]
  readonly t: UsageTranslate
  readonly format: (value: number) => string
  readonly formatPercent: (value: number) => string
}

interface Slice {
  readonly key: string
  readonly colorIndex: number
  readonly requests: number
  readonly share: number
}

/** Render the per-model request share as a donut with a ranked legend. */
export function UsageRequestsChart({
  days, t, format, formatPercent,
}: UsageRequestsChartProps): React.ReactElement {
  const slices = useMemo<Slice[]>(() => {
    const ranked = aggregateModels(days)
      .filter(model => model.requests > 0)
      .sort((left, right) => right.requests - left.requests)
    const total = ranked.reduce((sum, model) => sum + model.requests, 0)
    if (total === 0) return []
    const head: Slice[] = ranked.slice(0, MAX_SERIES).map((model, index) => ({
      key: `${model.provider}/${model.model}`,
      colorIndex: index,
      requests: model.requests,
      share: model.requests / total,
    }))
    const rest = ranked.slice(MAX_SERIES)
    if (rest.length > 0) {
      const requests = rest.reduce((sum, model) => sum + model.requests, 0)
      head.push({ key: '__others__', colorIndex: MAX_SERIES, requests, share: requests / total })
    }
    return head
  }, [days])

  if (slices.length === 0) {
    return <div className={css.chartBody}><div className={css.trendEmpty}>{t('noData')}</div></div>
  }

  const total = slices.reduce((sum, slice) => sum + slice.requests, 0)
  const circumference = 2 * Math.PI * RADIUS
  let drawn = 0

  return (
    <div className={css.chartBody}>
      <div className={css.donutWrap}>
        <svg className={css.donutSvg} viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img" aria-label={t('tabRequestDist')}>
          <circle className={css.donutTrack} cx={CENTER} cy={CENTER} r={RADIUS}
            fill="none" strokeWidth={THICKNESS} />
          <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
            {slices.map(slice => {
              const length = slice.share * circumference
              const offset = drawn
              drawn += length
              return (
                <circle key={slice.key} cx={CENTER} cy={CENTER} r={RADIUS} fill="none"
                  stroke={LINE_COLORS[slice.colorIndex]} strokeWidth={THICKNESS}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset} />
              )
            })}
          </g>
          <text className={css.donutTotal} x={CENTER} y={CENTER - 2} textAnchor="middle">
            {format(total)}
          </text>
          <text className={css.donutTotalLabel} x={CENTER} y={CENTER + 18} textAnchor="middle">
            {t('chartRequests')}
          </text>
        </svg>
        <ul className={css.donutLegend}>
          {slices.map(slice => (
            <li key={slice.key} className={css.donutLegendRow}>
              <span className={css.trendLegendDot} aria-hidden="true"
                style={{ backgroundColor: LINE_COLORS[slice.colorIndex] }} />
              <span className={css.donutName}>
                {slice.key === '__others__' ? t('other') : modelLabel(slice.key)}
              </span>
              <span className={css.donutValue}>{format(slice.requests)}</span>
              <span className={css.donutShare}>{formatPercent(slice.share)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
