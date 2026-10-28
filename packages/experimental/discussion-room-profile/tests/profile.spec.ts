import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as yaml from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'

describe('discussion-room profile bundle', () => {
  it('declares the explicit Agent Teams, Host, and Web layer', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      publishConfig?: { access?: string }
      dependencies?: Record<string, string>
      dsh?: { bundle?: { patch?: string } }
    }
    expect(manifest.publishConfig?.access).toBe('public')
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(manifest.dependencies).toMatchObject({
      '@deepseek-ai/dsh-experimental-agent-team': 'workspace:*',
      '@deepseek-ai/dsh-experimental-client-ui-discussion-room': 'workspace:*',
      '@deepseek-ai/dsh-experimental-discussion-room': 'workspace:*',
    })
    const parsed = yaml.load(readFileSync(resolve(root, 'cordis.patch.yml'), 'utf8'), { schema: entryListSchema }) as {
      insert?: { id: string; name: string; config?: Record<string, unknown> }[]
    }[]
    const inserted = parsed.flatMap(patch => patch.insert ?? [])
    expect(inserted).toEqual([
      { id: 'agent-team', name: '@deepseek-ai/dsh-experimental-agent-team' },
      {
        id: 'discussion-room', name: '@deepseek-ai/dsh-experimental-discussion-room',
        config: { provider: 'spawn', maxParticipants: 6, maxRoundLimit: 5, maxTokenLimit: 32768, maxPromptBytes: 131072 },
      },
      { id: 'ui-discussion-room', name: '@deepseek-ai/dsh-experimental-client-ui-discussion-room' },
    ])
  })
})
