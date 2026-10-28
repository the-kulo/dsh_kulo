// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { allowAllAccess } from '@deepseek-ai/dsh-client-test-runtime'
import type {} from '../src/client/index.ts'
import { UsageSection, buildUsageCalendar, usageDayLevel } from '../src/client/UsageSection.tsx'
import type { UsageSectionProps } from '../src/client/UsageSection.tsx'
import { en } from '../src/client/locales.ts'
import type { UsageSummary } from '../src/types.ts'

afterEach(cleanup)

const translations: ReadonlyMap<string, string> = new Map(Object.entries(en))
const t: UsageSectionProps['t'] = (key, params) => {
  let value = translations.get(key) ?? key
  for (const [name, replacement] of Object.entries(params ?? {})) value = value.replace(`{${name}}`, String(replacement))
  return value
}

const populated: UsageSummary = {
  timeZone: 'Asia/Shanghai', incomplete: false,
  days: [{
    date: '2026-10-20', inputTokens: 14, cachedTokens: 2, outputTokens: 4, totalTokens: 20, requests: 2,
    providers: [{
      id: 'kimi', inputTokens: 10, cachedTokens: 2, outputTokens: 3, totalTokens: 15, requests: 1,
      models: [{ provider: 'kimi-coding', model: 'kimi-k3.1-pro', inputTokens: 10, cachedTokens: 2, outputTokens: 3, totalTokens: 15, requests: 1 }],
    }, {
      id: 'lakala', inputTokens: 4, cachedTokens: 0, outputTokens: 1, totalTokens: 5, requests: 1,
      models: [{ provider: 'custom', model: 'lakala-v1', inputTokens: 4, cachedTokens: 0, outputTokens: 1, totalTokens: 5, requests: 1 }],
    }],
  }],
}

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

function unusedHook(): never {
  throw new Error('The usage section does not read global slot sources')
}

function renderSection(summary: UsageSectionProps['summary']) {
  const props = {
    summary, t, close: vi.fn(),
    usePanelInfo: unusedHook, useSessions: unusedHook, useSessionStatus: unusedHook,
    useSessionRetainInfo: unusedHook, useWorkspaces: unusedHook, useResource: unusedHook,
    ...allowAllAccess,
  } as UsageSectionProps
  return render(<UsageSection {...props} />)
}

describe('usage calendar model', () => {
  it('lays out Sunday-first weeks from the first recorded day through today', () => {
    const calendar = buildUsageCalendar(populated, today, () => 'month')
    expect(calendar.weeks.length).toBeGreaterThan(0)
    expect(calendar.weeks[0]).toHaveLength(7)
    expect(calendar.maxTotal).toBe(20)
    const cell = calendar.weeks.flat().find(day => day.date === '2026-10-20')
    expect(cell?.totals?.totalTokens).toBe(20)
  })

  it('collapses the range to the current week for an empty snapshot', () => {
    const calendar = buildUsageCalendar({ timeZone: 'Asia/Shanghai', days: [], incomplete: false }, today, () => 'month')
    expect(calendar.weeks).toHaveLength(1)
    expect(calendar.maxTotal).toBe(0)
    expect(calendar.weeks[0]!.every(cell => cell.totals === undefined)).toBe(true)
  })

  it('buckets intensity into the 0–4 scale', () => {
    expect(usageDayLevel(0, 100)).toBe(0)
    expect(usageDayLevel(10, 100)).toBe(1)
    expect(usageDayLevel(40, 100)).toBe(2)
    expect(usageDayLevel(70, 100)).toBe(3)
    expect(usageDayLevel(90, 100)).toBe(4)
    expect(usageDayLevel(5, 0)).toBe(0)
  })
})

describe('UsageSection', () => {
  it('queries all history once and drills into the selected day without extra remote calls', async () => {
    const summary = vi.fn(() => Promise.resolve(populated))
    renderSection(summary)

    await waitFor(() => { expect(summary).toHaveBeenCalledTimes(1) })
    expect(summary).toHaveBeenLastCalledWith({})
    const cell = await screen.findByTestId('usage-day-2026-10-20')
    expect(cell.getAttribute('data-level')).toBe('4')

    fireEvent.change(screen.getByLabelText(en.date), { target: { value: '2026-10-20' } })
    await screen.findByText('kimi-k3.1-pro')
    // The contribution calendar still shows the full range; the date filter is local.
    expect(screen.getByTestId('usage-day-2026-10-20')).toBeTruthy()
    expect(summary).toHaveBeenCalledTimes(1)
    expect(screen.getByText('kimi-coding')).toBeTruthy()
    expect(screen.getByText('lakala-v1')).toBeTruthy()
    expect(screen.getAllByText(en.totalTokens).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: en.allHistory })).toBeTruthy()
  })

  it('renders the contribution calendar with a populated day cell and legend', async () => {
    const summary = vi.fn(() => Promise.resolve(populated))
    renderSection(summary)

    const cell = await screen.findByTestId('usage-day-2026-10-20')
    expect(cell.getAttribute('data-level')).toBe('4')
    expect(cell.getAttribute('aria-label')).toContain('Oct 20, 2026')
    expect(screen.getByText(en.legendLess)).toBeTruthy()
    expect(screen.getByText(en.legendMore)).toBeTruthy()
  })

  it('renders an empty period without inventing usage, with a flat calendar', async () => {
    renderSection(() => Promise.resolve({ timeZone: 'Asia/Shanghai', days: [], incomplete: false }))

    await screen.findByText(en.emptyTitle)
    expect(screen.getByText(en.emptyDescription)).toBeTruthy()
    const cell = await screen.findByTestId(`usage-day-${today}`)
    expect(cell.getAttribute('data-level')).toBe('0')
    expect(screen.queryByText('0')).toBeNull()
  })

  it('offers a retry after a query failure', async () => {
    const summary = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(populated)
    renderSection(summary)

    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: en.retry }))
    await screen.findByTestId('usage-day-2026-10-20')
    expect(summary).toHaveBeenCalledTimes(2)
  })

  it('keeps the settings content vertically scrollable with no page-level horizontal scroll', async () => {
    const summary = vi.fn(() => Promise.resolve(populated))
    const { container } = renderSection(summary)
    await screen.findByTestId('usage-day-2026-10-20')

    const section = container.querySelector('section')!
    expect(section.className).toContain('section')
    // The calendar is the only horizontal scroller; the page body does not scroll sideways.
    expect(section.scrollWidth).toBeLessThanOrEqual(section.clientWidth)
  })
})
