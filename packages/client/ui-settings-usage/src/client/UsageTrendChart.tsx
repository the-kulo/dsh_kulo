/**
 * Pure-SVG trend line chart with a Tokens/Requests toggle.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/UsageTrendChart
 */

import { useMemo, useState } from 'react'
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
}

const VIEW_WIDTH = 760
const VIEW_HEIGHT = 200
const PADDING_LEFT = 48
const PADDING_RIGHT = 12
const PADDING_TOP = 16
const PADDING_BOTTOM = 28

/** SVG line chart of daily tokens or requests over the selected range. */
export function UsageTrendChart({ days, t, format, formatDate }: UsageTrendChartProps): React.ReactElement {
  const [metric, setMetric] = useState<TrendMetric>('tokens')

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
          <svg className={css.trendSvg} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={t('trend')}>
            {yTickValues.map((tick, i) => {
              const y = PADDING_TOP + chartHeight - (tick / maxValue) * chartHeight
              return (
                <g key={i}>
                  <line className={css.trendGridLine} x1={PADDING_LEFT} y1={y} x2={VIEW_WIDTH - PADDING_RIGHT} y2={y} />
                  <text className={css.trendAxisLabel} x={PADDING_LEFT - 6} y={y + 3} textAnchor="end">{format(Math.round(tick))}</text>
                </g>
              )
            })}
            {points.map((p, i) => {
              if (i === 0 || i === points.length - 1 || series.length <= 12 || i % Math.ceil(series.length / 8) === 0) {
                return <text key={`xl-${i}`} className={css.trendAxisLabel} x={p.x} y={VIEW_HEIGHT - 8} textAnchor="middle">{formatDate(p.date)}</text>
              }
              return null
            })}
            {areaPath !== '' ? <path className={css.trendArea} d={areaPath} /> : null}
            {linePath !== '' ? <path className={css.trendLine} d={linePath} /> : null}
            {points.map(p => (
              <circle key={p.date} className={css.trendDot} cx={p.x} cy={p.y} r={2.5}>
                <title>{`${formatDate(p.date)} — ${format(p.value)}`}</title>
              </circle>
            ))}
          </svg>
        )}
    </div>
  )
}
