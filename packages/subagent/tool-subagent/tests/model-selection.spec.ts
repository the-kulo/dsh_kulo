import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  assertModelCapabilities,
  compareModelCapabilities,
  selectModelForTask,
  type AllowedModelRoute,
  type ModelCapabilityTag,
} from '../src/model-selection.ts'

const route = (provider: string, model: string): AllowedModelRoute => ({ provider, model })
const capability = (entry: ModelCapabilityTag): ModelCapabilityTag => entry

describe('selectModelForTask', () => {
  it('keeps the historical provider/model id order when no metadata is declared', () => {
    const routes = [route('beta', 'b'), route('alpha', 'z'), route('alpha', 'a')]
    const capabilities: ModelCapabilityTag[] = [
      capability({ provider: 'beta', model: 'b', tags: ['code'], autoSelectable: true }),
      capability({ provider: 'alpha', model: 'z', tags: ['code'], autoSelectable: true }),
      capability({ provider: 'alpha', model: 'a', tags: ['code'], autoSelectable: true }),
    ]
    assert.deepEqual(selectModelForTask('code', routes, capabilities), route('alpha', 'a'))
  })

  it('prefers higher priority over cost and speed', () => {
    const routes = [route('p', 'cheap'), route('p', 'expensive')]
    const capabilities: ModelCapabilityTag[] = [
      capability({ provider: 'p', model: 'cheap', tags: ['code'], autoSelectable: true, cost: 'free', speed: 'fast' }),
      capability({ provider: 'p', model: 'expensive', tags: ['code'], autoSelectable: true, priority: 1, cost: 'high', speed: 'slow' }),
    ]
    assert.deepEqual(selectModelForTask('code', routes, capabilities), route('p', 'expensive'))
  })

  it('breaks priority ties by cost, then by speed', () => {
    const routes = [route('p', 'pricier'), route('p', 'cheaper'), route('p', 'slow'), route('p', 'fast')]
    const capabilities: ModelCapabilityTag[] = [
      capability({ provider: 'p', model: 'slow', tags: ['code'], autoSelectable: true, cost: 'low', speed: 'slow' }),
      capability({ provider: 'p', model: 'pricier', tags: ['code'], autoSelectable: true, cost: 'high', speed: 'fast' }),
      capability({ provider: 'p', model: 'cheaper', tags: ['code'], autoSelectable: true, cost: 'low', speed: 'balanced' }),
    ]
    assert.deepEqual(selectModelForTask('code', routes, capabilities), route('p', 'cheaper'))
    assert.deepEqual(
      selectModelForTask('code', routes, [
        capability({ provider: 'p', model: 'slow', tags: ['code'], autoSelectable: true, cost: 'low', speed: 'slow' }),
        capability({ provider: 'p', model: 'cheaper', tags: ['code'], autoSelectable: true, cost: 'low', speed: 'fast' }),
      ]),
      route('p', 'cheaper'),
    )
  })

  it('sorts undeclared cost and speed after every declared tier', () => {
    const routes = [route('p', 'undeclared'), route('p', 'declared')]
    const capabilities: ModelCapabilityTag[] = [
      capability({ provider: 'p', model: 'undeclared', tags: ['code'], autoSelectable: true }),
      capability({ provider: 'p', model: 'declared', tags: ['code'], autoSelectable: true, cost: 'high', speed: 'slow' }),
    ]
    assert.deepEqual(selectModelForTask('code', routes, capabilities), route('p', 'declared'))
  })

  it('never falls back to another specialty tag', () => {
    const routes = [route('p', 'flash-only')]
    const capabilities: ModelCapabilityTag[] = [
      capability({ provider: 'p', model: 'flash-only', tags: ['flash'], autoSelectable: true }),
    ]
    assert.throws(
      () => selectModelForTask('code', routes, capabilities),
      /automatic code subagent routing requires an allowed auto-selectable model tagged "code"/,
    )
  })

  it('matches specialty tags case-insensitively', () => {
    const routes = [route('p', 'm')]
    const capabilities: ModelCapabilityTag[] = [
      capability({ provider: 'p', model: 'm', tags: ['CODE'], autoSelectable: true }),
    ]
    assert.deepEqual(selectModelForTask('code', routes, capabilities), route('p', 'm'))
  })

  it('routes sensitive tasks only to LKL-GLM-5.2-FP8', () => {
    const routes = [route('p', 'other'), route('p', 'LKL-GLM-5.2-FP8')]
    const capabilities: ModelCapabilityTag[] = [
      capability({ provider: 'p', model: 'other', tags: ['reasoning'], autoSelectable: true, priority: 100 }),
      capability({ provider: 'p', model: 'LKL-GLM-5.2-FP8', tags: [], autoSelectable: true }),
    ]
    assert.deepEqual(selectModelForTask('sensitive', routes, capabilities), route('p', 'LKL-GLM-5.2-FP8'))
    assert.throws(
      () => selectModelForTask('sensitive', routes, capabilities.filter(entry => entry.model !== 'LKL-GLM-5.2-FP8')),
      /sensitive subagent tasks require "LKL-GLM-5\.2-FP8"/,
    )
  })

  it('skips routes that are not allowed or not auto-selectable and the unavailable endpoint', () => {
    const routes = [route('p', 'allowed')]
    const capabilities: ModelCapabilityTag[] = [
      capability({ provider: 'p', model: 'not-allowed', tags: ['flash'], autoSelectable: true, priority: 100 }),
      capability({ provider: 'p', model: 'TC-gpt-5.3-codex', tags: ['flash'], autoSelectable: true, priority: 100 }),
      capability({ provider: 'p', model: 'allowed', tags: ['flash'], autoSelectable: false }),
    ]
    assert.throws(
      () => selectModelForTask('simple', routes, capabilities),
      /automatic simple subagent routing requires an allowed auto-selectable model tagged "flash"/,
    )
  })
})

describe('compareModelCapabilities', () => {
  it('treats an omitted priority as 0', () => {
    const negative = capability({ provider: 'p', model: 'n', tags: [], autoSelectable: true, priority: -1 })
    const plain = capability({ provider: 'p', model: 'p', tags: [], autoSelectable: true })
    assert.ok(compareModelCapabilities(plain, negative) < 0)
  })
})

describe('assertModelCapabilities', () => {
  const valid = capability({ provider: 'p', model: 'm', tags: ['code'], autoSelectable: true })

  it('accepts declared priority, cost, and speed', () => {
    assert.doesNotThrow(() => assertModelCapabilities([
      { ...valid, priority: -2, cost: 'high', speed: 'slow' },
    ]))
  })

  it('rejects a non-integer or NaN priority', () => {
    assert.throws(() => assertModelCapabilities([{ ...valid, priority: Number.NaN }]), /priority/)
    assert.throws(() => assertModelCapabilities([{ ...valid, priority: 1.5 }]), /priority/)
  })

  it('rejects an unknown cost or speed tier', () => {
    assert.throws(() => assertModelCapabilities([{ ...valid, cost: 'premium' }]), /cost/)
    assert.throws(() => assertModelCapabilities([{ ...valid, speed: 'instant' }]), /speed/)
  })

  it('rejects duplicate routes', () => {
    assert.throws(
      () => assertModelCapabilities([valid, { ...valid, priority: 1 }]),
      /repeats capabilities for "p\/m"/,
    )
  })
})
