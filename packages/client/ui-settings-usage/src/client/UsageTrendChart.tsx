/**
 * Multi-model SVG trend chart with per-model area gradients, hover tooltip,
 * and a metric toggle for tokens vs requests.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/UsageTrendChart
 */

import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import type { UsageDaySummary, UsageTotals } from '../types.ts'
import { aggregateByPeriod, consumedTokens, type AggregatedPeriod } from './usageAggregate.ts'
import {
  VIEW_WIDTH, VIEW_HEIGHT, PADDING_LEFT, PADDING_RIGHT, PADDING_TOP, PADDING_BOTTOM,
  LINE_COLORS, MAX_SERIES, ZERO_USAGE, modelLabel, rankTopModels,
} from './chartShared.ts'
import type { UsageTranslate } from './chartShared.ts'
import css from './UsageSection.module.css'

type TrendMetric = 'tokens' | 'requests'

/** Props for the multi-model trend chart. */
export interface UsageTrendChartProps {
  readonly days: readonly UsageDaySummary[]
  readonly granularity: 'day' | 'week'
  readonly t: UsageTranslate
  readonly format: (value: number) => string
  readonly formatDate: (value: string) => string
  readonly formatAxisDate: (value: string) => string
}

function modelValue(totals: UsageTotals, metric: TrendMetric): number {
  return metric === 'tokens' ? consumedTokens(totals) : totals.requests
}

/** Render one line per highest-consumption model plus a folded remainder series. */
export function UsageTrendChart({
  days, granularity, t, format, formatDate, formatAxisDate,
}: UsageTrendChartProps): React.ReactElement {
  const [metric, setMetric] = useState<TrendMetric>('tokens')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const locale = t('locale')

  const formatCompact = useMemo(() =>
    new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }), [locale])

  const periods = useMemo(() => aggregateByPeriod(days, granularity), [days, granularity])

  const lines = useMemo(() => {
    if (periods.length === 0) return [] as { key: string; colorIndex: number; data: number[] }[]
    const { ranked, hasOthers } = rankTopModels(periods)
    const result: { key: string; colorIndex: number; data: number[] }[] = ranked.map((key, i) => ({
      key,
      colorIndex: i,
      data: periods.map(period => modelValue(period.models[key] ?? ZERO_USAGE, metric)),
    }))
    if (hasOthers) {
      const topSet = new Set(ranked)
      result.push({
        key: '__others__',
        colorIndex: MAX_SERIES,
        data: periods.map(period => {
          let acc = 0
          for (const [key, totals] of Object.entries(period.models)) {
            if (!topSet.has(key)) acc += modelValue(totals, metric)
          }
          return acc
        }),
      })
    }
    return result
  }, [periods, metric])

  const maxValue = useMemo(() => {
    let max = 1
    for (const line of lines) {
      for (const value of line.data) if (value > max) max = value
    }
    return max
  }, [lines])

  const chartWidth = VIEW_WIDTH - PADDING_LEFT - PADDING_RIGHT
  const chartHeight = VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const xStep = periods.length > 1 ? chartWidth / (periods.length - 1) : 0

  const linePaths = useMemo(() => lines.map(line => {
    if (line.data.length === 0) return { area: '', line: '' }
    const pts = line.data.map((value, index) => ({
      x: PADDING_LEFT + index * xStep,
      y: PADDING_TOP + chartHeight - (value / maxValue) * chartHeight,
    }))
    const lineD = pts.map((point, index) =>
      `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
    const baseline = (PADDING_TOP + chartHeight).toFixed(1)
    const areaD = `${lineD} L${pts[pts.length - 1]!.x.toFixed(1)},${baseline} L${pts[0]!.x.toFixed(1)},${baseline} Z`
    return { area: areaD, line: lineD }
  }), [lines, maxValue, xStep])

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

  function handleMove(event: MouseEvent<SVGSVGElement>): void {
    if (periods.length === 0 || xStep === 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH
    const index = Math.max(0, Math.min(periods.length - 1, Math.round((x - PADDING_LEFT) / xStep)))
    setHoverIndex(index)
  }

  const hovered = hoverIndex !== null ? periods[hoverIndex] : undefined
  const hoverPoints = useMemo(() => {
    if (hoverIndex === null || xStep === 0) return []
    return lines.map(line => {
      const value = line.data[hoverIndex] ?? 0
      return {
        key: line.key,
        colorIndex: line.colorIndex,
        x: PADDING_LEFT + hoverIndex * xStep,
        y: PADDING_TOP + chartHeight - (value / maxValue) * chartHeight,
        value,
      }
    })
  }, [hoverIndex, lines, xStep, maxValue])

  const isEmpty = periods.length === 0 || lines.length === 0

  return (
    <div className={css.chartBody}>
      <div className={css.trendHeader}>
        <div className={css.trendToggle} role="group" aria-label={t('tabTrend')}>
          <button type="button" className={css.trendBtn}
            data-active={metric === 'tokens' ? 'true' : undefined}
            onClick={() => { setMetric('tokens') }}>{t('trendTokens')}</button>
          <button type="button" className={css.trendBtn}
            data-active={metric === 'requests' ? 'true' : undefined}
            onClick={() => { setMetric('requests') }}>{t('trendRequests')}</button>
        </div>
      </div>
      {isEmpty
        ? <div className={css.trendEmpty}>{t('noData')}</div>
        : (
          <svg className={css.trendSvg} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            preserveAspectRatio="none" role="img" aria-label={t('tabTrend')}
            onMouseMove={handleMove} onMouseLeave={() => { setHoverIndex(null) }}>
            <defs>
              {LINE_COLORS.slice(0, MAX_SERIES).map((color, ci) => (
                <linearGradient key={ci} id={`usage-trend-area-${ci}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
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
            {periods.map((period, index) => {
              if (!labelIndices.has(index)) return null
              const anchor = index === 0 ? 'start' : index === periods.length - 1 ? 'end' : 'middle'
              return <text key={`xl-${index}`} className={css.trendAxisLabel}
                x={PADDING_LEFT + index * xStep} y={VIEW_HEIGHT - 8}
                textAnchor={anchor}>{formatAxisDate(period.period)}</text>
            })}
            {linePaths.map((path, index) => {
              const line = lines[index]!
              return (
                <g key={line.key}>
                  {line.colorIndex < MAX_SERIES && path.area !== ''
                    ? <path d={path.area} fill={`url(#usage-trend-area-${line.colorIndex})`} />
                    : null}
                  {path.line !== ''
                    ? <path d={path.line} fill="none" stroke={LINE_COLORS[line.colorIndex]}
                      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    : null}
                </g>
              )
            })}
            {hoverPoints.length > 0 && hovered !== undefined
              ? (
                <g pointerEvents="none">
                  <line className={css.trendGuide} x1={hoverPoints[0]!.x} y1={PADDING_TOP}
                    x2={hoverPoints[0]!.x} y2={PADDING_TOP + chartHeight} />
                  {hoverPoints.map(point => (
                    <circle key={point.key} cx={point.x} cy={point.y} r={3.5}
                      fill={LINE_COLORS[point.colorIndex]}
                      stroke="var(--dsw-alias-bg-layer-1)" strokeWidth={2} />
                  ))}
                  <TrendTooltip hoverPoints={hoverPoints} format={format}
                    formatDate={formatDate} period={hovered} t={t} />
                </g>
              )
              : null}
          </svg>
        )}
      <div className={css.trendFooter}>
        {lines.map(line => (
          <span key={line.key} className={css.trendLegendItem}>
            <span className={css.trendLegendDot} aria-hidden="true"
              style={{ backgroundColor: LINE_COLORS[line.colorIndex] }} />
            {line.key === '__others__' ? t('other') : modelLabel(line.key)}
          </span>
        ))}
      </div>
    </div>
  )
}

function TrendTooltip({ hoverPoints, format, formatDate, period, t }: {
  readonly hoverPoints: readonly { key: string; colorIndex: number; x: number; y: number; value: number }[]
  readonly format: (value: number) => string
  readonly formatDate: (value: string) => string
  readonly period: AggregatedPeriod
  readonly t: UsageTranslate
}): React.ReactElement {
  const dateText = formatDate(period.date ?? period.period)
  const height = 20 + hoverPoints.length * 18
  const labelWidths = hoverPoints.map(point => {
    const label = point.key === '__others__' ? t('other') : modelLabel(point.key)
    return (label.length + format(point.value).length) * 7 + 48
  })
  const width = Math.max(dateText.length * 7 + 24, ...labelWidths)
  const anchorX = hoverPoints[0]?.x ?? 0
  const x = Math.max(PADDING_LEFT, Math.min(anchorX - width / 2, VIEW_WIDTH - PADDING_RIGHT - width))
  const y = Math.max(PADDING_TOP, (hoverPoints[0]?.y ?? 0) - height - 12)

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect className={css.trendTooltipBg} width={width} height={height} rx={6} />
      <text className={css.trendTooltipText} x={12} y={16}>{dateText}</text>
      {hoverPoints.map((point, index) => (
        <g key={point.key} transform={`translate(12, ${30 + index * 18})`}>
          <circle cx={4} cy={-5} r={3} fill={LINE_COLORS[point.colorIndex]} />
          <text className={css.trendTooltipValue} x={10} y={0}>
            {point.key === '__others__' ? t('other') : modelLabel(point.key)}: {format(point.value)}
          </text>
        </g>
      ))}
    </g>
  )
}
