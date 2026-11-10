/** Path-to-tree derivation: sorting, nesting, and status propagation. */

import { describe, expect, it } from 'vitest'
import { buildGitTree } from '../src/client/git-panel/tree.ts'
import type { GitFileView } from '@deepseek-ai/dsh-api-git-controller/types'

function file(path: string, state: GitFileView['state'] = 'modified', staged = false): GitFileView {
  return { path, state, staged }
}

/**
 * Read one required row of a derived tree.
 * @param rows - tree rows.
 * @param index - row position.
 * @returns the row at `index`.
 * @throws If the tree has no row at `index`.
 */
function at<T>(rows: readonly T[], index: number): T {
  const row = rows[index]
  if (row === undefined) throw new Error(`expected a node at index ${String(index)}`)
  return row
}

describe('buildGitTree', () => {
  it('returns empty for no changes', () => {
    expect(buildGitTree([])).toEqual([])
  })

  it('places a single file at the root', () => {
    const tree = buildGitTree([file('README.md')])
    expect(tree).toHaveLength(1)
    expect(tree[0]).toMatchObject({ name: 'README.md', path: 'README.md', kind: 'file' })
  })

  it('nests a file inside one directory', () => {
    const tree = buildGitTree([file('src/index.ts')])
    expect(tree).toHaveLength(1)
    const node = at(tree, 0)
    expect(node).toMatchObject({ name: 'src', path: 'src', kind: 'directory' })
    if (node.kind === 'directory') {
      expect(node.children).toHaveLength(1)
      expect(node.children[0]).toMatchObject({ name: 'index.ts', path: 'src/index.ts', kind: 'file' })
    }
  })

  it('sorts directories before files, then by name', () => {
    const tree = buildGitTree([
      file('b.txt'),
      file('a/a.txt'),
      file('a.txt'),
      file('c.txt'),
    ])
    // Directories first: a/, then files: a.txt, b.txt, c.txt
    expect(tree[0]).toMatchObject({ name: 'a', kind: 'directory' })
    expect(tree[1]).toMatchObject({ name: 'a.txt', kind: 'file' })
    expect(tree[2]).toMatchObject({ name: 'b.txt', kind: 'file' })
    expect(tree[3]).toMatchObject({ name: 'c.txt', kind: 'file' })
  })

  it('sorts nested directory children the same way', () => {
    const tree = buildGitTree([
      file('src/core/module.ts'),
      file('src/alpha.ts'),
      file('src/core/a.ts'),
    ])
    expect(tree).toHaveLength(1)
    const src = at(tree, 0)
    if (src.kind === 'directory') {
      // src/ children sorted: core/ (dir), alpha.ts (file)
      expect(src.children[0]).toMatchObject({ name: 'core', kind: 'directory' })
      expect(src.children[1]).toMatchObject({ name: 'alpha.ts', kind: 'file' })
      const core = at(src.children, 0)
      if (core.kind === 'directory') {
        // core/ children: a.ts, module.ts
        expect(core.children[0]).toMatchObject({ name: 'a.ts' })
        expect(core.children[1]).toMatchObject({ name: 'module.ts' })
      }
    }
  })

  it('aggregates file states into directory states', () => {
    const tree = buildGitTree([
      { path: 'src/added.ts', state: 'added', staged: false },
      { path: 'src/modified.ts', state: 'modified', staged: false },
    ])
    expect(tree).toHaveLength(1)
    const node = at(tree, 0)
    if (node.kind === 'directory') {
      expect(node.states.has('added')).toBe(true)
      expect(node.states.has('modified')).toBe(true)
      expect(node.states.size).toBe(2)
    }
  })

  it('merges files sharing a prefix into one directory node', () => {
    const tree = buildGitTree([
      file('packages/a/foo.ts'),
      file('packages/b/bar.ts'),
    ])
    expect(tree).toHaveLength(1)
    const node = at(tree, 0)
    if (node.kind === 'directory') {
      expect(node.name).toBe('packages')
      expect(node.children).toHaveLength(2)
      expect(node.children[0]).toMatchObject({ name: 'a', kind: 'directory' })
      expect(node.children[1]).toMatchObject({ name: 'b', kind: 'directory' })
    }
  })

  it('handles deep paths', () => {
    const tree = buildGitTree([
      file('very/deeply/nested/path/file.ts'),
    ])
    let node = at(tree, 0)
    expect(node).toMatchObject({ name: 'very', kind: 'directory' })
    if (node.kind === 'directory') {
      node = at(node.children, 0)
      expect(node).toMatchObject({ name: 'deeply', kind: 'directory' })
      if (node.kind === 'directory') {
        node = at(node.children, 0)
        expect(node).toMatchObject({ name: 'nested', kind: 'directory' })
        if (node.kind === 'directory') {
          node = at(node.children, 0)
          expect(node).toMatchObject({ name: 'path', kind: 'directory' })
          if (node.kind === 'directory') {
            expect(node.children[0]).toMatchObject({ name: 'file.ts', kind: 'file' })
          }
        }
      }
    }
  })

  it('propagates staged flag to file leaves', () => {
    const tree = buildGitTree([
      { path: 'staged.ts', state: 'added', staged: true },
      { path: 'unstaged.ts', state: 'modified', staged: false },
    ])
    expect(tree).toHaveLength(2)
    const staged = at(tree, 0)
    const unstaged = at(tree, 1)
    expect(staged.kind === 'file' && staged.staged).toBe(true)
    expect(unstaged.kind === 'file' && unstaged.staged).toBe(false)
  })
})
