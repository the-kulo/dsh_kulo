/**
 * Paginated per-period, per-model cache-hit table for the usage dashboard.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/UsageCacheTable
 */

import { useMemo, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { UsageDaySummary } from '../types.ts'
import { aggregateByPeriod, consumedTokens } from './usageAggregate.ts'
import { modelLabel } from './chartShared.ts'
import type { UsageTranslate } from './chartShared.ts'
import css from './UsageSection.module.css'

const PAGE_SIZE = 20

interface CacheRow {
  readonly period: string
  readonly date?: string
  readonly modelKey: string
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cachedTokens: number
  readonly hitRate?: number
}

/** Props for the cache analysis table. */
export interface UsageCacheTableProps {
  readonly days: readonly UsageDaySummary[]
  readonly granularity: 'day' | 'week'
  readonly t: UsageTranslate
  readonly format: (value: number) => string
  readonly formatPercent: (value: number) => string
  readonly formatRowTime: (period: string, date?: string) => string
}

/** Render the cache-hit table with client-side pagination. */
export function UsageCacheTable({
  days, granularity, t, format, formatPercent, formatRowTime,
}: UsageCacheTableProps): React.ReactElement {
  const [page, setPage] = useState(0)

  const rows = useMemo<CacheRow[]>(() => {
    const flat: CacheRow[] = []
    for (const period of aggregateByPeriod(days, granularity)) {
      for (const [modelKey, totals] of Object.entries(period.models)) {
        if (consumedTokens(totals) === 0) continue
        const denominator = totals.inputTokens + totals.cachedTokens
        flat.push({
          period: period.period,
          ...period.date === undefined ? {} : { date: period.date },
          modelKey,
          inputTokens: totals.inputTokens,
          outputTokens: totals.outputTokens,
          cachedTokens: totals.cachedTokens,
          ...denominator > 0 ? { hitRate: totals.cachedTokens / denominator } : {},
        })
      }
    }
    return flat.sort((left, right) =>
      right.period.localeCompare(left.period)
      || right.cachedTokens - left.cachedTokens
      || left.modelKey.localeCompare(right.modelKey),
    )
  }, [days, granularity])

  if (rows.length === 0) {
    return <div className={css.chartBody}><div className={css.trendEmpty}>{t('noData')}</div></div>
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const visible = rows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className={css.cacheTable}>
      <div className={css.cacheScroll}>
        <table className={css.table}>
          <thead>
            <tr>
              <th>{t('tableModel')}</th>
              <th>{t('tableTime')}</th>
              <th>{t('tableInput')}</th>
              <th>{t('tableOutput')}</th>
              <th>{t('tableCached')}</th>
              <th>{t('tableHitRate')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(row => (
              <tr key={`${row.period}-${row.modelKey}`}>
                <th scope="row">{modelLabel(row.modelKey)}</th>
                <td>{formatRowTime(row.period, row.date)}</td>
                <td>{format(row.inputTokens)}</td>
                <td>{format(row.outputTokens)}</td>
                <td>{format(row.cachedTokens)}</td>
                <td>
                  <span className={css.hitCell}>
                    <span className={css.hitTrack}>
                      <span className={css.hitFill}
                        style={{ width: `${Math.round((row.hitRate ?? 0) * 100)}%` }} />
                    </span>
                    <span className={css.hitValue}>
                      {row.hitRate === undefined ? t('cacheHitDash') : formatPercent(row.hitRate)}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className={css.cacheFooter}>
        <span className={css.cacheTotal}>{t('totalCount', { count: format(rows.length) })}</span>
        <div className={css.cachePager}>
          <Button size="sm" variant="outline" disabled={currentPage === 0}
            onClick={() => { setPage(Math.max(0, currentPage - 1)) }}>{t('paginationPrev')}</Button>
          <span className={css.cachePageInfo}>
            {t('paginationInfo', {
              from: format(currentPage * PAGE_SIZE + 1),
              to: format(Math.min(rows.length, (currentPage + 1) * PAGE_SIZE)),
              total: format(rows.length),
            })}
          </span>
          <Button size="sm" variant="outline" disabled={currentPage >= pageCount - 1}
            onClick={() => { setPage(Math.min(pageCount - 1, currentPage + 1)) }}>{t('paginationNext')}</Button>
        </div>
      </footer>
    </div>
  )
}
