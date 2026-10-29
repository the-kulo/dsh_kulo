/**
 * Time-range filter bar with presets and custom date inputs.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/UsageTimeRange
 */

import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { UsageSectionProps } from './UsageSection.tsx'
import type { UsageRangePreset } from './usageAggregate.ts'
import css from './UsageSection.module.css'

/** Props for the time-range filter. */
export interface UsageTimeRangeProps {
  readonly preset: UsageRangePreset
  readonly customFrom: string
  readonly customTo: string
  readonly today: string
  readonly t: UsageSectionProps['t']
  readonly onChange: (preset: UsageRangePreset, customFrom?: string, customTo?: string) => void
}

const PRESETS: readonly UsageRangePreset[] = ['today', '7d', '30d', 'all', 'custom']

/** Render the time-range preset buttons and optional custom date inputs. */
export function UsageTimeRange({ preset, customFrom, customTo, today, t, onChange }: UsageTimeRangeProps): React.ReactElement {
  return (
    <div className={css.rangeBar}>
      <div className={css.rangePresets}>
        {PRESETS.map(key => (
          <Button
            key={key}
            size="sm"
            variant={preset === key ? 'primary' : 'outline'}
            onClick={() => { onChange(key, customFrom || undefined, customTo || undefined) }}
          >
            {rangeLabel(t, key)}
          </Button>
        ))}
      </div>
      {preset === 'custom'
        ? (
          <div className={css.rangeCustom}>
            <Input
              type="date"
              aria-label={t('customFrom')}
              value={customFrom}
              max={customTo || today}
              onChange={event => { onChange('custom', event.target.value || undefined, customTo || undefined) }}
            />
            <Input
              type="date"
              aria-label={t('customTo')}
              value={customTo}
              min={customFrom || undefined}
              max={today}
              onChange={event => { onChange('custom', customFrom || undefined, event.target.value || undefined) }}
            />
          </div>
        )
        : null}
    </div>
  )
}

function rangeLabel(t: UsageTimeRangeProps['t'], preset: UsageRangePreset): string {
  if (preset === 'today') return t('rangeToday')
  if (preset === '7d') return t('range7d')
  if (preset === '30d') return t('range30d')
  if (preset === 'all') return t('rangeAll')
  return t('rangeCustom')
}
