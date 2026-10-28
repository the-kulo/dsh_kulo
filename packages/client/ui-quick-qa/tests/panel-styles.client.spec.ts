/**
 * QuickQaPanel layout contract, asserted against the CSS text on disk: the
 * footer seat splits the sidebar region with the Workspace browsing stack
 * through equal zero-basis flex halves, and the history scrolls its own
 * overflow instead of resizing the seat.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/QuickQaPanel.module.css', import.meta.url)), 'utf8')

/**
 * Declarations of one selector rule, keyed by property with whitespace collapsed.
 * Declaration order and trailing semicolons are normalized away.
 * @param selector - one exact selector, including a leading dot for local classes.
 * @returns the rule's declarations, or undefined when no such rule exists.
 */
function declarations(selector: string): Map<string, string> | undefined {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const found = new Map<string, string>()
  for (const [, selectorList = '', body = ''] of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selectorList.split(',').map(value => value.trim()).includes(selector)) continue
    for (const part of body.split(';')) {
      const colon = part.indexOf(':')
      if (colon === -1) continue
      found.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim().replace(/\s+/g, ' '))
    }
  }
  return found.size === 0 ? undefined : found
}

describe('QuickQaPanel.module.css', () => {
  it('shares the region height with the browsing stack from a zero basis', () => {
    // Equal flex grows from flex-basis 0 give each seat half the sidebar
    // region; the percentage cap is gone, so a short history leaves its half
    // visibly empty rather than clipping into a meaningless scrollbar.
    const root = declarations('.root')
    expect(root).toBeDefined()
    expect(root!.get('flex')).toBe('1 1 0')
    expect(root!.get('max-height')).toBeUndefined()
  })

  it('keeps a usable floor in a very short sidebar', () => {
    // Below the floor the browsing stack takes the rest; the seat never
    // shrinks its title row into the border.
    expect(declarations('.root')!.get('min-height')).toBe('96px')
  })

  it('scrolls history overflow inside the seat', () => {
    const history = declarations('.history')
    expect(history).toBeDefined()
    expect(history!.get('flex')).toBe('1 1 auto')
    expect(history!.get('min-height')).toBe('0')
    expect(history!.get('overflow-y')).toBe('auto')
    expect(history!.get('overflow-x')).toBe('hidden')
  })

  it('reserves no empty scrollbar track on short history', () => {
    // The zero-basis split is not content-sized, so a stable gutter would
    // show a dead track whenever the history fits its half; the declaration
    // stays absent rather than overriding the default with a named value.
    expect(declarations('.history')!.get('scrollbar-gutter')).toBeUndefined()
  })
})
