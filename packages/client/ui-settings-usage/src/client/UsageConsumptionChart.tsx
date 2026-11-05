/**
 * Stacked bar chart of consumed tokens per model over the selected periods.
 * Clicking a bar opens a modal with the period's provider/model breakdown.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/UsageConsumptionChart
 */

import { useMemo, useState } from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { UsageDaySummary } from '../types.ts'
import { aggregateByPeriod, consumedTokens } from './usageAggregate.ts'
import type { AggregatedPeriod } from './usageAggregate.ts'
import {
  VIEW_WIDTH, VIEW_HEIGHT, PADDING_LEFT, PADDING_RIGHT, PADDING_TOP, PADDING_BOTTOM,
  LINE_COLORS, ZERO_USAGE, formatAxisValue, modelLabel, niceAxis, rankTopModels,
} from './chartShared.ts'
import type { UsageTranslate } from './chartShared.ts'
import css from './UsageSection.module.css'

/** One model row inside the period detail modal. */
interface BreakdownModel {
  readonly key: string
  readonly model: string
  readonly tokens: number
}

/** One provider group inside the period detail modal. */
interface BreakdownGroup {
  readonly provider: string
  readonly tokens: number
  readonly models: readonly BreakdownModel[]
}

/**
 * Group one period's `provider/model` totals by provider.
 * @param period Aggregated period whose models carry provider-prefixed keys.
 * @returns Provider groups with their model rows, each sorted by consumed tokens descending.
 */
function breakdownByProvider(period: AggregatedPeriod): BreakdownGroup[] {
  const groups = new Map<string, { tokens: number; models: BreakdownModel[] }>()
  for (const [key, usage] of Object.entries(period.models)) {
    const tokens = consumedTokens(usage)
    const slash = key.lastIndexOf('/')
    const provider = slash === -1 ? '' : key.slice(0, slash)
    const model = slash === -1 ? key : key.slice(slash + 1)
    const group = groups.get(provider) ?? { tokens: 0, models: [] }
    group.tokens += tokens
    group.models.push({ key, model, tokens })
    groups.set(provider, group)
  }
  return [...groups.entries()]
    .map(([provider, group]) => ({
      provider,
      tokens: group.tokens,
      models: group.models.sort((a, b) => b.tokens - a.tokens),
    }))
    .sort((a, b) => b.tokens - a.tokens)
}

/** Format a token count in compact k/M units for the modal. */
function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(Math.round(value))
}

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
  days, granularity, t, formatAxisDate,
}: UsageConsumptionChartProps): React.ReactElement {
  const periods = useMemo(() => aggregateByPeriod(days, granularity), [days, granularity])
  const [selected, setSelected] = useState<AggregatedPeriod | null>(null)
  const breakdown = useMemo(() => selected === null ? [] : breakdownByProvider(selected), [selected])

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

  const axis = useMemo(() => niceAxis(maxValue), [maxValue])
  const axisMax = axis.max === 0 ? 1 : axis.max

  const chartWidth = VIEW_WIDTH - PADDING_LEFT - PADDING_RIGHT
  const chartHeight = VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const step = periods.length > 0 ? chartWidth / periods.length : 0
  const barWidth = Math.min(step * 0.6, 56)
  const barOffset = (step - barWidth) / 2

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
            {axis.ticks.map((tick, i) => {
              const y = PADDING_TOP + chartHeight - (tick / axisMax) * chartHeight
              return (
                <g key={i}>
                  <line className={css.trendGridLine} x1={PADDING_LEFT} y1={y}
                    x2={VIEW_WIDTH - PADDING_RIGHT} y2={y} />
                  <text className={css.trendAxisLabel} x={PADDING_LEFT - 8} y={y + 3}
                    textAnchor="end">{formatAxisValue(tick)}</text>
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
            {periods.map((period, pi) => {
              let cumulative = 0
              const barX = PADDING_LEFT + pi * step + barOffset
              return (
                <g key={period.period} className={css.barHit}
                  onClick={() => { setSelected(period) }}>
                  <title>{formatAxisDate(period.period)}</title>
                  {stacks.map(stack => {
                    const height = ((stack.data[pi] ?? 0) / axisMax) * chartHeight
                    const y = PADDING_TOP + chartHeight - cumulative - height
                    cumulative += height
                    return height > 0
                      ? <rect key={`${stack.key}-${pi}`} x={barX} y={y}
                        width={barWidth} height={height}
                        fill={LINE_COLORS[stack.colorIndex]} rx={1}
                        className={css.barRect} />
                      : null
                  })}
                </g>
              )
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
      <Modal
        open={selected !== null}
        onClose={() => { setSelected(null) }}
        title={selected === null ? '' : formatAxisDate(selected.period)}
        closeLabel={t('close')}
        className={css.consumptionDialog as string}
      >
        <div className={css.breakdownList}>
          {breakdown.map(group => (
            <div key={group.provider} className={css.breakdownGroup}>
              <div className={css.breakdownProvider}>
                <span className={css.breakdownProviderName}>{group.provider}</span>
                <span className={css.breakdownValue}>{formatTokens(group.tokens)}</span>
              </div>
              {group.models.map(row => (
                <div key={row.key} className={css.breakdownModel}>
                  <span className={css.breakdownModelName}>{row.model}</span>
                  <span className={css.breakdownValue}>{formatTokens(row.tokens)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
