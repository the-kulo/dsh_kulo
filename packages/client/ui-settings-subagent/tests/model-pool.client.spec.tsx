// @vitest-environment jsdom
/** Model Pool decision fields: declared metadata, real usage, and staged edits. */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { SubagentModelSelectionFields } from '../src/client/SubagentModelSelectionFields.tsx'
import type {
  ModelCapabilityTag,
  ModelUsageSummary,
  SubagentModelCandidate,
  SubagentModelSelectionCardState,
} from '../src/client/subagent-model-selection-card-controller.ts'
import { en, type SubagentSettingsLocaleKey } from '../src/client/locales.ts'

/** Resolve copy from this page's dictionary; unknown keys fall back to their name. */
const t: TranslateNS<'settings.subagent'> = (key, params) => {
  const template = key in en ? en[key as SubagentSettingsLocaleKey] : key
  return template.replace(/\{(\w+)\}/g, (match, name) => String(params?.[name] ?? match))
}

const selectedCandidate: SubagentModelCandidate = {
  provider: 'lakala',
  model: 'TC-kimi-k3',
  key: 'lakala\0TC-kimi-k3',
  providerName: 'Lakala',
  modelName: 'Kimi K3',
  available: true,
  selected: true,
  capability: {
    provider: 'lakala',
    model: 'TC-kimi-k3',
    tags: ['code', 'reasoning'],
    autoSelectable: true,
    priority: 5,
    cost: 'high',
    speed: 'balanced',
  } satisfies ModelCapabilityTag,
}

const bareCandidate: SubagentModelCandidate = {
  provider: 'kimi',
  model: 'k2',
  key: 'kimi\0k2',
  providerName: 'Kimi',
  modelName: 'K2',
  available: true,
  selected: true,
  capability: { provider: 'kimi', model: 'k2', tags: ['flash'], autoSelectable: true },
}

const usageOf = (requests: number, totalTokens: number): ModelUsageSummary => ({ requests, totalTokens })

function makeState(overrides: Partial<SubagentModelSelectionCardState> = {}): SubagentModelSelectionCardState {
  return {
    available: true,
    writable: true,
    dirty: false,
    invalid: false,
    saving: false,
    failed: false,
    enabled: true,
    candidates: [selectedCandidate, bareCandidate],
    catalogStatus: 'ready',
    catalogPartial: false,
    conflicted: false,
    autoSelect: true,
    usage: new Map([[selectedCandidate.key, usageOf(42, 123_456)]]),
    ...overrides,
  }
}

function makeActions() {
  return {
    toggleEnabled: vi.fn(),
    toggleModel: vi.fn(),
    retryCatalog: vi.fn(),
    toggleAutoSelect: vi.fn(),
    toggleAutoSelectable: vi.fn(),
    setCapabilityTags: vi.fn(),
    setCapabilityPriority: vi.fn(),
    setCapabilityCost: vi.fn(),
    setCapabilitySpeed: vi.fn(),
  }
}

function renderFields(
  state: Partial<SubagentModelSelectionCardState>,
  actions = makeActions(),
): ReturnType<typeof render> {
  return render(<SubagentModelSelectionFields t={t} state={makeState(state)} {...actions} />)
}

/** Accessible name the field uses for one exact route. */
function labelOf(candidate: SubagentModelCandidate, copy: string): string {
  return `${candidate.provider}/${candidate.model} ${copy}`
}

afterEach(cleanup)

describe('SubagentModelSelectionFields', () => {
  it('labels every declared decision field and the real seven-day usage', () => {
    renderFields({})
    expect(screen.getByRole('spinbutton', { name: labelOf(selectedCandidate, en.subagentModelSelectionCapabilityPriority) })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: labelOf(selectedCandidate, en.subagentModelSelectionCapabilityCost) })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: labelOf(selectedCandidate, en.subagentModelSelectionCapabilitySpeed) })).toBeTruthy()
    expect(screen.getByText('42 requests · 123456 tokens')).toBeTruthy()
  })

  it('explains the automatic routing order only while automatic selection is on', () => {
    renderFields({})
    expect(screen.getByText(en.subagentModelSelectionRoutingRules)).toBeTruthy()
    cleanup()
    renderFields({ autoSelect: false })
    expect(screen.queryByText(en.subagentModelSelectionRoutingRules)).toBeNull()
  })

  it('hides the usage row when the usage dashboard is not mounted', () => {
    renderFields({ usage: undefined })
    expect(screen.queryByText(en.subagentModelSelectionUsage)).toBeNull()
  })

  it('reports unavailable usage instead of a count when loading failed', () => {
    renderFields({ usage: null })
    // Every selected route renders its own row; both report the same failure.
    expect(screen.getAllByText(en.subagentModelSelectionUsageUnavailable)).toHaveLength(2)
  })

  it('shows the declared tiers and stages priority, cost, and speed edits for the exact route', () => {
    const actions = makeActions()
    renderFields({}, actions)
    const priority = screen.getByRole('spinbutton', {
      name: labelOf(selectedCandidate, en.subagentModelSelectionCapabilityPriority),
    }) as HTMLInputElement
    const cost = screen.getByRole('combobox', {
      name: labelOf(selectedCandidate, en.subagentModelSelectionCapabilityCost),
    }) as HTMLSelectElement
    const speed = screen.getByRole('combobox', {
      name: labelOf(selectedCandidate, en.subagentModelSelectionCapabilitySpeed),
    }) as HTMLSelectElement
    expect(priority.value).toBe('5')
    expect(cost.value).toBe('high')
    expect(speed.value).toBe('balanced')
    fireEvent.change(priority, { target: { value: '-3' } })
    fireEvent.change(cost, { target: { value: 'free' } })
    fireEvent.change(speed, { target: { value: '' } })
    expect(actions.setCapabilityPriority).toHaveBeenCalledWith(selectedCandidate.key, '-3')
    expect(actions.setCapabilityCost).toHaveBeenCalledWith(selectedCandidate.key, 'free')
    expect(actions.setCapabilitySpeed).toHaveBeenCalledWith(selectedCandidate.key, '')
  })

  it('leaves undeclared tiers empty and shows priority as zero', () => {
    renderFields({ candidates: [bareCandidate], usage: new Map() })
    expect((screen.getByRole('spinbutton', {
      name: labelOf(bareCandidate, en.subagentModelSelectionCapabilityPriority),
    }) as HTMLInputElement).value).toBe('0')
    expect((screen.getByRole('combobox', {
      name: labelOf(bareCandidate, en.subagentModelSelectionCapabilityCost),
    }) as HTMLSelectElement).value).toBe('')
    expect((screen.getByRole('combobox', {
      name: labelOf(bareCandidate, en.subagentModelSelectionCapabilitySpeed),
    }) as HTMLSelectElement).value).toBe('')
  })
})
