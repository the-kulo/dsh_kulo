import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { runLoaderSmoke, LOADER_SMOKE_TEST_TIMEOUT_MS } from '@deepseek-ai/dsh-loader-smoke'
import type { UsageSummary } from '../src/types.ts'

it('aggregates parent and delegated actual routes through the shipped Loader composition', async () => {
  const driver = resolve(import.meta.dirname, 'fixtures/usage.host.ts')
  let captured: { initial: UsageSummary; incremental: UsageSummary } | undefined
  await runLoaderSmoke({
    label: 'Token usage dashboard', tempDirPrefix: 'usage-dashboard-',
    binScript: driver, libBinScript: driver,
    configPath: resolve(import.meta.dirname, 'fixtures/usage.patch.yml'),
    tsconfigPath: resolve(import.meta.dirname, '../../../../tsconfig.base.json'),
    inspect: async (cwd) => {
      captured = JSON.parse(await readFile(resolve(cwd, 'usage-summary.json'), 'utf8')) as typeof captured
    },
  })
  expect(captured).toBeDefined()
  const initial = captured!.initial.days[0]!
  expect(initial.providers.find(provider => provider.id === 'kimi')).toMatchObject({ totalTokens: 15, requests: 1 })
  expect(initial.providers.find(provider => provider.id === 'lakala')).toMatchObject({ totalTokens: 5, requests: 1 })
  const lakala = captured!.incremental.days[0]!.providers.find(provider => provider.id === 'lakala')!
  expect(lakala).toMatchObject({ inputTokens: 10, cachedTokens: 1, outputTokens: 3, totalTokens: 14, requests: 2 })
  expect(lakala.models).toHaveLength(1)
}, LOADER_SMOKE_TEST_TIMEOUT_MS)
