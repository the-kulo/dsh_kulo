/**
 * Pure-SVG trend chart with axis ticks, an area gradient, and a hover tooltip.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/UsageTrendChart
 */

import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import type { UsageSectionProps } from './UsageSection.tsx'
import type { UsageDaySummary } from '../types.ts'
import { consumedTokens } from './usageAggregate.ts'
import css from './UsageSection.module.css'

type TrendMetric = 'tokens' | 'requests'

/** Props for the trend chart. */
export interface UsageTrendChartProps {
  readonly days: readonly UsageDaySummary[]
  readonly t: UsageSectionProps['t']
  readonly format: (value: number) => string
  readonly formatDate: (value: string) => string
  readonly formatAxisDate: (value: string) => string
}

const VIEW_WIDTH = 760
const VIEW_HEIGHT = 260
const PADDING_LEFT = 52
const PADDING_RIGHT = 16
const PADDING_TOP = 18
const PADDING_BOTTOM = 30

const AREA_GRADIENT_ID = 'usage-trend-area-gradient'

/** SVG line chart of daily tokens or requests over the selected range. */
export function UsageTrendChart({ days, t, format, formatDate, formatAxisDate }: UsageTrendChartProps): React.ReactElement {
  const [metric, setMetric] = useState<TrendMetric>('tokens')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const locale = t('locale')

  const formatCompact = useMemo(() =>
    new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }), [locale])

  const series = useMemo(() => {
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
    return sorted.map(day => ({
      date: day.date,
      tokens: consumedTokens(day),
      requests: day.requests,
    }))
  }, [days])

  const values = series.map(point => metric === 'tokens' ? point.tokens : point.requests)
  const maxValue = values.length > 0 ? Math.max(...values, 1) : 1

  const chartWidth = VIEW_WIDTH - PADDING_LEFT - PADDING_RIGHT
  const chartHeight = VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM

  const xStep = series.length > 1 ? chartWidth / (series.length - 1) : 0
  const points = series.map((point, index) => {
    const value = metric === 'tokens' ? point.tokens : point.requests
    const x = PADDING_LEFT + index * xStep
    const y = PADDING_TOP + chartHeight - (value / maxValue) * chartHeight
    return { x, y, value, date: point.date }
  })

  const linePath = points.length > 0
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    : ''
  const areaPath = points.length > 0
    ? `${linePath} L${points[points.length - 1]!.x.toFixed(1)},${(PADDING_TOP + chartHeight).toFixed(1)} L${points[0]!.x.toFixed(1)},${(PADDING_TOP + chartHeight).toFixed(1)} Z`
    : ''

  const yTicks = 4
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxValue / yTicks) * i)

  function handleMove(event: MouseEvent<SVGSVGElement>): void {
    if (points.length === 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH
    const index = Math.max(0, Math.min(points.length - 1, Math.round((x - PADDING_LEFT) / xStep)))
    setHoverIndex(index)
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : undefined

  return (
    <div className={css.trendWrap}>
      <div className={css.trendHeader}>
        <span className={css.trendTitle}>{t('trend')}</span>
        <div className={css.trendToggle} role="group" aria-label={t('trend')}>
          <button
            type="button"
            className={css.trendBtn}
            data-active={metric === 'tokens' ? 'true' : undefined}
            onClick={() => { setMetric('tokens') }}
          >
            {t('trendTokens')}
          </button>
          <button
            type="button"
            className={css.trendBtn}
            data-active={metric === 'requests' ? 'true' : undefined}
            onClick={() => { setMetric('requests') }}
          >
            {t('trendRequests')}
          </button>
        </div>
      </div>
      {series.length === 0
        ? <div className={css.trendEmpty}>{t('noData')}</div>
        : (
          <svg
            className={css.trendSvg}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={t('trend')}
            onMouseMove={handleMove}
            onMouseLeave={() => { setHoverIndex(null) }}
          >
            <defs>
              <linearGradient id={AREA_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                <stop className={css.trendAreaStopTop} offset="0%" />
                <stop className={css.trendAreaStopBottom} offset="100%" />
              </linearGradient>
              <clipPath id="chart-x-clip">
                <rect x={PADDING_LEFT} y={0} width={chartWidth} height={VIEW_HEIGHT} />
              </clipPath>
            </defs>
            {yTickValues.map((tick, i) => {
              const y = PADDING_TOP + chartHeight - (tick / maxValue) * chartHeight
              return (
                <g key={i}>
                  <line className={css.trendGridLine} x1={PADDING_LEFT} y1={y} x2={VIEW_WIDTH - PADDING_RIGHT} y2={y} />
                  <text className={css.trendAxisLabel} x={PADDING_LEFT - 8} y={y + 3} textAnchor="end">{formatCompact.format(Math.round(tick))}</text>
                </g>
              )
            })}
            <g clipPath="url(#chart-x-clip)">
              {points.map((p, i) => {
                if (i === 0 || i === points.length - 1 || series.length <= 12 || i % Math.ceil(series.length / 8) === 0) {
                  const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'
                  return <text key={`xl-${i}`} className={css.trendAxisLabel} x={p.x} y={VIEW_HEIGHT - 8} textAnchor={anchor}>{formatAxisDate(p.date)}</text>
                }
                return null
              })}
            </g>
            {areaPath !== '' ? <path className={css.trendArea} d={areaPath} /> : null}
            {linePath !== '' ? <path className={css.trendLine} d={linePath} /> : null}
            {hovered !== undefined
              ? (
                <g pointerEvents="none">
                  <line className={css.trendGuide} x1={hovered.x} y1={PADDING_TOP} x2={hovered.x} y2={PADDING_TOP + chartHeight} />
                  <circle className={css.trendHoverDot} cx={hovered.x} cy={hovered.y} r={4} />
                  <TrendTooltip point={hovered} format={format} formatDate={formatDate} />
                </g>
              )
              : null}
            {points.map(p => <circle key={p.date} className={css.trendDot} cx={p.x} cy={p.y} r={2.5} />)}
          </svg>
        )}
      <div className={css.trendFooter}>
        <span className={css.trendLegendItem}>
          <span className={css.trendLegendDot} aria-hidden="true" />
          {metric === 'tokens' ? t('trendTokens') : t('trendRequests')}
        </span>
      </div>
    </div>
  )
}

function TrendTooltip({ point, format, formatDate }: {
  readonly point: { readonly x: number; readonly y: number; readonly value: number; readonly date: string }
  readonly format: (value: number) => string
  readonly formatDate: (value: string) => string
}): React.ReactElement {
  const dateText = formatDate(point.date)
  const valueText = format(point.value)
  const width = Math.max(dateText.length, valueText.length) * 7 + 24
  const x = Math.max(PADDING_LEFT, Math.min(point.x - width / 2, VIEW_WIDTH - PADDING_RIGHT - width))
  const y = Math.max(PADDING_TOP, point.y - 52)
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect className={css.trendTooltipBg} width={width} height={40} rx={6} />
      <text className={css.trendTooltipText} x={12} y={16}>{dateText}</text>
      <text className={css.trendTooltipValue} x={12} y={30}>{valueText}</text>
    </g>
  )
}
