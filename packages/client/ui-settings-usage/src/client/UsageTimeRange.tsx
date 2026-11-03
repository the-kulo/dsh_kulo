/**
 * Time-range filter bar with presets, custom date inputs, granularity toggle, model filter, and query button.
 * @module @deepseek-ai/dsh-client-ui-settings-usage/client/UsageTimeRange
 */

import { useState } from 'react'
import {
  Button, Checkbox, IconChevronDownOutlineRegular, Input, Menu, MenuItemButton,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { UsageLocaleKey } from './locales.ts'
import type { UsageTranslate } from './chartShared.ts'
import type { UsageRangePreset } from './usageAggregate.ts'
import css from './UsageSection.module.css'

/** Granularity options for trend charts and breakdown tables. */
export type UsageGranularity = 'day' | 'week' | 'hour'

/** Props for the time-range filter. */
export interface UsageTimeRangeProps {
  readonly preset: UsageRangePreset
  readonly customFrom: string
  readonly customTo: string
  readonly today: string
  readonly t: UsageTranslate
  onChange: (preset: UsageRangePreset, customFrom?: string, customTo?: string) => void

  readonly granularity: UsageGranularity
  readonly onGranularityChange: (granularity: UsageGranularity) => void

  readonly selectedModels: ReadonlySet<string>
  readonly allModels: readonly string[]
  readonly onModelsChange: (models: ReadonlySet<string>) => void

  readonly onQuery: () => void
}

const GRANULARITY_OPTIONS: readonly { readonly value: UsageGranularity; readonly labelKey: UsageLocaleKey }[] = [
  { value: 'day', labelKey: 'granularityDay' },
  { value: 'week', labelKey: 'granularityWeek' },
  { value: 'hour', labelKey: 'granularityHour' },
]

const PRESETS: readonly UsageRangePreset[] = ['today', '7d', '30d', 'all', 'custom']

const PRESET_KEYS: Record<UsageRangePreset, UsageLocaleKey> = {
  today: 'rangeToday',
  '7d': 'range7d',
  '30d': 'range30d',
  all: 'rangeAll',
  custom: 'rangeCustom',
}

/** Render the range presets, custom dates, granularity toggle, model filter, and query button. */
export function UsageTimeRange({
  preset, customFrom, customTo, today, t, onChange,
  granularity, onGranularityChange,
  selectedModels, allModels, onModelsChange, onQuery,
}: UsageTimeRangeProps): React.ReactElement {
  const [modelMenuOpen, setModelMenuOpen] = useState(false)

  const toggleModel = (model: string): void => {
    const next = new Set(selectedModels)
    if (next.has(model)) next.delete(model)
    else next.add(model)
    onModelsChange(next)
  }

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
            {t(PRESET_KEYS[key])}
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
      <div className={css.actionBar}>
        <div className={css.granularityToggle} role="group" aria-label={t('granularityDay')}>
          {GRANULARITY_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={css.trendBtn}
              data-active={granularity === option.value ? 'true' : undefined}
              disabled={option.value === 'hour'}
              title={option.value === 'hour' ? t('granularityHourHint') : undefined}
              onClick={() => { onGranularityChange(option.value) }}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
        <Menu
          align="end"
          open={modelMenuOpen}
          anchor={
            <Button
              size="sm"
              variant="outline"
              icon={<IconChevronDownOutlineRegular />}
              onClick={() => { setModelMenuOpen(value => !value) }}
            >
              {t('modelFilter')}
              {allModels.length > 0 && selectedModels.size > 0 && (
                <span className={css.modelFilterCount}>{selectedModels.size}</span>
              )}
            </Button>
          }
          onClose={() => { setModelMenuOpen(false) }}
          portal
          listClassName={css.modelDropdown}
        >
          {allModels.map(model => (
            <MenuItemButton
              key={model}
              icon={
                <span onClick={event => event.stopPropagation()}>
                  <Checkbox
                    checked={selectedModels.has(model)}
                    onChange={() => { toggleModel(model) }}
                    label=""
                  />
                </span>
              }
              onSelect={() => { toggleModel(model) }}
            >
              {model}
            </MenuItemButton>
          ))}
        </Menu>
        <Button size="sm" variant="primary" onClick={onQuery}>{t('query')}</Button>
      </div>
    </div>
  )
}
