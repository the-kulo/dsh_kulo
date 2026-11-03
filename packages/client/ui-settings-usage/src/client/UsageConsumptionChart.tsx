/**
 * Stacked bar chart of consumed tokens per model over the selected periods.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/UsageConsumptionChart
 */

import { useMemo } from 'react'
import type { UsageDaySummary } from '../types.ts'
import { aggregateByPeriod, consumedTokens } from './usageAggregate.ts'
import {
  VIEW_WIDTH, VIEW_HEIGHT, PADDING_LEFT, PADDING_RIGHT, PADDING_TOP, PADDING_BOTTOM,
  LINE_COLORS, ZERO_USAGE, modelLabel, rankTopModels,
} from './chartShared.ts'
import type { UsageTranslate } from './chartShared.ts'
import css from './UsageSection.module.css'

/** Props for the consumption distribution chart. */
export interface UsageConsumptionChartProps {
  readonly days: readonly UsageDaySummary[]
  readonly granularity: 'day' | 'week'
  readonly t: UsageTranslate
  readonly formatCompact: Intl.NumberFormat
  readonly formatAxisDate: (value: string) => string
}

/** Render per-model stacked bars of consumed tokens. */
export function UsageConsumptionChart({
  days, granularity, t, formatCompact, formatAxisDate,
}: UsageConsumptionChartProps): React.ReactElement {
  const periods = useMemo(() => aggregateByPeriod(days, granularity), [days, granularity])

  const stacks = useMemo(() => {
    if (periods.length === 0) return [] as { key: string; colorIndex: number; data: number[] }[]
    const { ranked, hasOthers } = rankTopModels(periods)
    const result: { key: string; colorIndex: number; data: number[] }[] = ranked.map((key, i) => ({
      key,
      colorIndex: i,
      data: periods.map(p => consumedTokens(p.models[key] ?? ZERO_USAGE)),
    }))
    if (hasOthers) {
      const topSet = new Set(ranked)
      result.push({
        key: '__others__',
        colorIndex: 4,
        data: periods.map(p => {
          let acc = 0
          for (const [key, model] of Object.entries(p.models)) {
            if (!topSet.has(key)) acc += consumedTokens(model)
          }
          return acc
        }),
      })
    }
    return result
  }, [periods])

  const maxValue = useMemo(() => {
    let max = 1
    for (let pi = 0; pi < periods.length; pi += 1) {
      let total = 0
      for (const stack of stacks) total += stack.data[pi] ?? 0
      if (total > max) max = total
    }
    return max
  }, [periods, stacks])

  const chartWidth = VIEW_WIDTH - PADDING_LEFT - PADDING_RIGHT
  const chartHeight = VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const step = periods.length > 0 ? chartWidth / periods.length : 0
  const barWidth = Math.min(step * 0.6, 56)
  const barOffset = (step - barWidth) / 2

  const yTicks = 4
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxValue / yTicks) * i)

  const labelIndices = useMemo(() => {
    if (periods.length <= 10) return new Set(periods.map((_, i) => i))
    const ticks = 8
    const indices = new Set<number>()
    for (let k = 0; k <= ticks; k += 1) {
      indices.add(Math.round((k * (periods.length - 1)) / ticks))
    }
    return indices
  }, [periods])

  const isEmpty = periods.length === 0 || stacks.length === 0

  return (
    <div className={css.chartBody}>
      {isEmpty
        ? <div className={css.trendEmpty}>{t('noData')}</div>
        : (
          <svg className={css.trendSvg} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            preserveAspectRatio="none" role="img" aria-label={t('tabConsumption')}>
            {yTickValues.map((tick, i) => {
              const y = PADDING_TOP + chartHeight - (tick / maxValue) * chartHeight
              return (
                <g key={i}>
                  <line className={css.trendGridLine} x1={PADDING_LEFT} y1={y}
                    x2={VIEW_WIDTH - PADDING_RIGHT} y2={y} />
                  <text className={css.trendAxisLabel} x={PADDING_LEFT - 8} y={y + 3}
                    textAnchor="end">{formatCompact.format(Math.round(tick))}</text>
                </g>
              )
            })}
            {periods.map((p, pi) => {
              if (!labelIndices.has(pi)) return null
              const anchor = pi === 0 ? 'start' : pi === periods.length - 1 ? 'end' : 'middle'
              const x = PADDING_LEFT + (pi + 0.5) * step
              return <text key={`xl-${pi}`} className={css.trendAxisLabel} x={x}
                y={VIEW_HEIGHT - 8} textAnchor={anchor}>{formatAxisDate(p.period)}</text>
            })}
            {periods.map((_period, pi) => {
              let cumulative = 0
              const barX = PADDING_LEFT + pi * step + barOffset
              return stacks.map(stack => {
                const height = ((stack.data[pi] ?? 0) / maxValue) * chartHeight
                const y = PADDING_TOP + chartHeight - cumulative - height
                cumulative += height
                return height > 0
                  ? <rect key={`${stack.key}-${pi}`} x={barX} y={y}
                    width={barWidth} height={height}
                    fill={LINE_COLORS[stack.colorIndex]} rx={1} />
                  : null
              })
            })}
          </svg>
        )}
      <div className={css.trendFooter}>
        {stacks.map(stack => (
          <span key={stack.key} className={css.trendLegendItem}>
            <span className={css.trendLegendDot} aria-hidden="true"
              style={{ backgroundColor: LINE_COLORS[stack.colorIndex] }} />
            {stack.key === '__others__' ? t('other') : modelLabel(stack.key)}
          </span>
        ))}
      </div>
    </div>
  )
}
