// @vitest-environment jsdom
/** The Model Pool settings section as the Settings shell renders it: one form, one save. */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { allowAllAccess, bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { ModelPoolSection, modelPoolSectionShell, type ModelPoolSectionProps } from '../src/client/ModelPoolSection.tsx'
import type { SettingsFormShell } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SubagentModelSelectionCardState } from '../src/client/subagent-model-selection-card-controller.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const translations: ReadonlyMap<string, string> = new Map(Object.entries(en))
const t: ModelPoolSectionProps['t'] = (key, params) => {
  let value = translations.get(key) ?? key
  for (const [name, replacement] of Object.entries(params ?? {})) value = value.replace(`{${name}}`, String(replacement))
  return value
}

const settled: SettingsFormShell = {
  available: true,
  writable: true,
  dirty: false,
  invalid: false,
  saving: false,
  failed: false,
}

function unusedHook(): never {
  throw new Error('The Model Pool section does not read global slot sources')
}

function renderModelPool(modelState: Partial<SubagentModelSelectionCardState> = {}) {
  const models = createSnapshotStore<SubagentModelSelectionCardState>({
    ...settled,
    enabled: false,
    candidates: [],
    catalogStatus: 'idle',
    catalogPartial: false,
    conflicted: false,
    autoSelect: false,
    ...modelState,
  })
  const actions = {
    toggleEnabled: vi.fn(),
    toggleModel: vi.fn(),
    toggleAutoSelect: vi.fn(),
    toggleAutoSelectable: vi.fn(),
    setCapabilityTags: vi.fn(),
    retryCatalog: vi.fn(),
    save: vi.fn(),
    discard: vi.fn(),
  }
  const props = {
    ...actions,
    t,
    close: vi.fn(),
    useSubagentModelSelectionCard: bindSnapshotSelector(models),
    usePanelInfo: unusedHook, useSessions: unusedHook, useSessionStatus: unusedHook,
    useSessionRetainInfo: unusedHook, useWorkspaces: unusedHook, useResource: unusedHook,
    ...allowAllAccess,
  } as ModelPoolSectionProps
  const { container } = render(<ModelPoolSection {...props} />)
  return { actions, models, container }
}

describe('modelPoolSectionShell', () => {
  it('derives the footer from the models form alone', () => {
    const base: SubagentModelSelectionCardState = {
      ...settled, enabled: false, candidates: [], catalogStatus: 'idle', catalogPartial: false, conflicted: false, autoSelect: false,
    }
    expect(modelPoolSectionShell(base)).toEqual(settled)
    expect(modelPoolSectionShell({ ...base, dirty: true, conflicted: true }).invalid).toBe(true)
    expect(modelPoolSectionShell({ ...base, available: false }).available).toBe(false)
  })
})

describe('ModelPoolSection', () => {
  it('renders the staged model pool form with its save footer', () => {
    const { actions } = renderModelPool({ enabled: true, catalogStatus: 'ready' })

    expect(screen.getByRole('heading', { name: en.modelPoolTitle })).toBeTruthy()
    expect(screen.getByText(en.modelPoolDescription)).toBeTruthy()
    const control = screen.getByRole('switch', { name: en.subagentModelSelectionToggle })
    fireEvent.click(control)
    expect(actions.toggleEnabled).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: en.save })).toHaveProperty('disabled', true)
  })

  it('toggles automatic selection and edits a route\'s pool metadata', () => {
    const { actions } = renderModelPool({
      enabled: true,
      autoSelect: true,
      dirty: true,
      candidates: [{
        key: 'alpha\0fast',
        provider: 'alpha',
        model: 'fast',
        providerName: 'Alpha API',
        modelName: 'Fast',
        available: true,
        selected: true,
        capability: { provider: 'alpha', model: 'fast', tags: ['flash'], autoSelectable: true },
      }],
      catalogStatus: 'ready',
    })

    fireEvent.click(screen.getByRole('switch', { name: en.subagentModelSelectionAutoSelect }))
    expect(actions.toggleAutoSelect).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('checkbox', {
      name: `alpha/fast ${en.subagentModelSelectionCapabilityAutoSelectable}`,
    }))
    expect(actions.toggleAutoSelectable).toHaveBeenCalledWith('alpha\0fast')
    fireEvent.change(screen.getByRole('textbox', {
      name: `alpha/fast ${en.subagentModelSelectionCapabilityTags}`,
    }), { target: { value: 'code' } })
    expect(actions.setCapabilityTags).toHaveBeenCalledWith('alpha\0fast', 'code')

    fireEvent.click(screen.getByRole('button', { name: en.save }))
    expect(actions.save).toHaveBeenCalledOnce()
  })

  it('says so when the Host does not serve model selection', () => {
    renderModelPool({ available: false })
    expect(screen.getByText(en.modelPoolUnavailable)).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('locks the form while the save is in flight', () => {
    const { models } = renderModelPool({ enabled: true, dirty: true })
    act(() => { models.set({ ...models.getSnapshot(), saving: true }) })
    expect(screen.getByRole('switch', { name: en.subagentModelSelectionToggle })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: en.saving })).toHaveProperty('disabled', true)
  })

  it('keeps the settings content vertically scrollable with no page-level horizontal scroll', () => {
    const { container } = renderModelPool({ enabled: true, catalogStatus: 'ready' })
    const section = container.querySelector('section')!
    expect(section.className).toContain('section')
    expect(section.scrollWidth).toBeLessThanOrEqual(section.clientWidth)
  })
})
