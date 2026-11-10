import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  buildGitStatus,
  entryToChange,
  mergeBranchFacts,
  parseBranchLine,
  parsePorcelainV2,
  xyToState,
} from '../src/porcelain.ts'
import type { GitRepository } from '../src/types.ts'

const testRepo: GitRepository = {
  root: '/home/user/project',
  gitDir: '/home/user/project/.git',
  branch: 'main',
  remote: 'git@github.com:user/project.git',
}

describe('parseBranchLine', () => {
  it('parses oid', () => {
    assert.deepEqual(parseBranchLine('# branch.oid 2c5e131f5a92e9425725a979d3f25fd5949e6183'), {
      oid: '2c5e131f5a92e9425725a979d3f25fd5949e6183',
    })
  })

  it('parses head', () => {
    assert.deepEqual(parseBranchLine('# branch.head main'), { branch: 'main' })
  })

  it('parses head for a detached HEAD', () => {
    assert.deepEqual(parseBranchLine('# branch.head (detached)'), { branch: '(detached)' })
  })

  it('parses the unborn-branch oid literally', () => {
    // git's own output for a repository without commits.
    assert.deepEqual(parseBranchLine('# branch.oid (initial)'), { oid: '(initial)' })
  })

  it('parses upstream', () => {
    assert.deepEqual(parseBranchLine('# branch.upstream origin/main'), { upstream: 'origin/main' })
  })

  it('parses ab with ahead only', () => {
    assert.deepEqual(parseBranchLine('# branch.ab +3 -0'), { ahead: 3, behind: 0 })
  })

  it('parses ab with behind only', () => {
    assert.deepEqual(parseBranchLine('# branch.ab +0 -5'), { ahead: 0, behind: 5 })
  })

  it('parses ab with both', () => {
    assert.deepEqual(parseBranchLine('# branch.ab +2 -1'), { ahead: 2, behind: 1 })
  })

  it('returns empty for unknown key', () => {
    assert.deepEqual(parseBranchLine('# branch.unknown value'), {})
  })
})

describe('mergeBranchFacts', () => {
  it('merges multiple partial facts', () => {
    const facts = [
      { oid: 'abc123' },
      { branch: 'main' },
      { upstream: 'origin/main' },
      { ahead: 2, behind: 1 },
    ]
    assert.deepEqual(mergeBranchFacts(facts), {
      branch: 'main',
      oid: 'abc123',
      upstream: 'origin/main',
      ahead: 2,
      behind: 1,
    })
  })

  it('defaults to HEAD for missing branch', () => {
    assert.deepEqual(mergeBranchFacts([{ oid: 'abc' }]), {
      branch: 'HEAD',
      oid: 'abc',
      ahead: 0,
      behind: 0,
    })
  })
})

describe('xyToState', () => {
  it('maps modified index', () => {
    assert.strictEqual(xyToState('M.'), 'modified')
  })

  it('maps modified worktree', () => {
    assert.strictEqual(xyToState('.M'), 'modified')
  })

  it('maps added', () => {
    assert.strictEqual(xyToState('A.'), 'added')
  })

  it('maps deleted', () => {
    assert.strictEqual(xyToState('D.'), 'deleted')
  })

  it('maps rename', () => {
    assert.strictEqual(xyToState('R.'), 'renamed')
  })

  it('maps conflicted', () => {
    assert.strictEqual(xyToState('UU'), 'conflicted')
  })
})

describe('parsePorcelainV2', () => {
  it('parses branch headers and ordinary entries', () => {
    const output = [
      '# branch.oid abc123def456',
      '# branch.head main',
      '# branch.upstream origin/main',
      '# branch.ab +2 -0',
      '1 M. N... 100644 100644 100644 abc123def abc123def src/index.ts',
      '1 .M N... 100644 100644 100644 abc123def abc123def src/local.ts',
      '? src/untracked.ts',
    ].join('\0') + '\0'

    const result = parsePorcelainV2(output)
    assert.strictEqual(result.branch.branch, 'main')
    assert.strictEqual(result.branch.oid, 'abc123def456')
    assert.strictEqual(result.branch.upstream, 'origin/main')
    assert.strictEqual(result.branch.ahead, 2)
    assert.strictEqual(result.branch.behind, 0)
    assert.strictEqual(result.entries.length, 3)
    assert.strictEqual(result.entries[0]!.type, 'ordinary')
    assert.strictEqual(result.entries[0]!.xy, 'M.')
    assert.strictEqual(result.entries[1]!.type, 'ordinary')
    assert.strictEqual(result.entries[1]!.xy, '.M')
    assert.strictEqual(result.entries[2]!.type, 'untracked')
  })

  it('parses rename entries with real -z format', () => {
    // Byte-for-byte shape of `git status --porcelain=v2 --branch -z` for a
    // staged rename: path is the last space-separated field of the entry
    // token; only origPath is a separate NUL-terminated token.
    const output = [
      '# branch.oid abc',
      '# branch.head main',
      '# branch.ab +0 -0',
      '2 R. N... 100644 100644 100644 abc123 def456 R100 f.txt',
      'e.txt',
    ].join('\0') + '\0'

    const result = parsePorcelainV2(output)
    assert.strictEqual(result.entries.length, 1)
    assert.strictEqual(result.entries[0]!.type, 'ordinary')
    assert.strictEqual(result.entries[0]!.xy, 'R.')
    assert.strictEqual(result.entries[0]!.path, 'f.txt')
    assert.strictEqual(result.entries[0]!.origPath, 'e.txt')
  })

  it('consumes exactly one NUL token for origPath', () => {
    const output = [
      '# branch.oid abc',
      '# branch.head main',
      '# branch.ab +0 -0',
      '2 R. N... 100644 100644 100644 abc123 def456 R100 e.txt',
      'd.txt',
      '1 A. N... 000000 100644 100644 0000000000000000000000000000000000000000 abc123 added.txt',
    ].join('\0') + '\0'

    const result = parsePorcelainV2(output)
    assert.strictEqual(result.entries.length, 2)
    assert.strictEqual(result.entries[0]!.path, 'e.txt')
    assert.strictEqual(result.entries[0]!.origPath, 'd.txt')
    assert.strictEqual(result.entries[1]!.path, 'added.txt')
  })

  it('parses unmerged entries', () => {
    const output = [
      '# branch.oid abc',
      '# branch.head main',
      '# branch.ab +0 -0',
      'u UU N... 100644 100644 100644 100644 abc def abc src/conflict.ts',
    ].join('\0') + '\0'

    const result = parsePorcelainV2(output)
    assert.strictEqual(result.entries.length, 1)
    assert.strictEqual(result.entries[0]!.type, 'unmerged')
    assert.strictEqual(result.entries[0]!.path, 'src/conflict.ts')
  })

  it('handles empty output', () => {
    const result = parsePorcelainV2('')
    assert.strictEqual(result.branch.branch, 'HEAD')
    assert.strictEqual(result.branch.oid, 'initial')
    assert.strictEqual(result.entries.length, 0)
  })

  it('parses real unborn-branch output', () => {
    // `git init -b main` with one untracked file and no commits.
    const output = [
      '# branch.oid (initial)',
      '# branch.head main',
      '? x.txt',
    ].join('\0') + '\0'

    const result = parsePorcelainV2(output)
    assert.strictEqual(result.branch.branch, 'main')
    assert.strictEqual(result.branch.oid, '(initial)')
    assert.strictEqual(result.entries.length, 1)
  })

  it('parses real detached-HEAD output', () => {
    // After `git checkout --detach`.
    const output = [
      '# branch.oid 2c5e131f5a92e9425725a979d3f25fd5949e6183',
      '# branch.head (detached)',
      '? z.txt',
    ].join('\0') + '\0'

    const result = parsePorcelainV2(output)
    assert.strictEqual(result.branch.branch, '(detached)')
    assert.strictEqual(result.branch.oid, '2c5e131f5a92e9425725a979d3f25fd5949e6183')
    assert.strictEqual(result.entries.length, 1)
  })

  it('parses real captured output end to end', () => {
    // Exact bytes of `git status --porcelain=v2 --branch -z` from a probe repo:
    // one staged modification, one unstaged modification, one unstaged delete,
    // one staged delete, one staged rename (e.txt -> f.txt), two untracked.
    const output = [
      '# branch.oid 2c5e131f5a92e9425725a979d3f25fd5949e6183',
      '# branch.head main',
      '1 M. N... 100644 100644 100644 78981922613b2afb6025042ff6bd878ac1994e85 c53a8ced1bee0ed9c45e653619d29389c17a8f04 a.txt',
      '1 .M N... 100644 100644 100644 61780798228d17af2d34fce4cfbdf35556832472 61780798228d17af2d34fce4cfbdf35556832472 b.txt',
      '1 .D N... 100644 100644 000000 f2ad6c76f0115a6ba5b00456a849810e7ec0af20 f2ad6c76f0115a6ba5b00456a849810e7ec0af20 c.txt',
      '1 D. N... 100644 000000 000000 4bcfe98e640c8284511312660fb8709b0afa888e 0000000000000000000000000000000000000000 d.txt',
      '2 R. N... 100644 100644 100644 d905d9da82c97264ab6f4920e20242e088850ce9 d905d9da82c97264ab6f4920e20242e088850ce9 R100 f.txt',
      'e.txt',
      '? status.bin',
      '? untracked.txt',
    ].join('\0') + '\0'

    const status = buildGitStatus(output, testRepo)
    assert.strictEqual(status.clean, false)
    assert.strictEqual(status.ahead, 0)
    assert.strictEqual(status.behind, 0)
    assert.deepEqual(status.changes.map((c) => [c.path, c.state, c.staged]), [
      ['a.txt', 'modified', true],
      ['b.txt', 'modified', false],
      ['c.txt', 'deleted', false],
      ['d.txt', 'deleted', true],
      ['f.txt', 'renamed', true],
      ['status.bin', 'untracked', false],
      ['untracked.txt', 'untracked', false],
    ])
    assert.strictEqual(status.changes[4]!.originalPath, 'e.txt')
  })

  it('discards ignored entries', () => {
    const output = [
      '# branch.oid abc',
      '# branch.head main',
      '# branch.ab +0 -0',
      '! node_modules/foo.js',
      '? src/new.ts',
    ].join('\0') + '\0'

    const result = parsePorcelainV2(output)
    // Ignored entries are parsed but discarded by entryToChange
    assert.strictEqual(result.entries.length, 2)
    assert.strictEqual(result.entries[0]!.type, 'ignored')
    assert.strictEqual(result.entries[1]!.type, 'untracked')
  })
})

describe('entryToChange', () => {
  it('maps untracked', () => {
    const change = entryToChange({ type: 'untracked', xy: '??', path: 'src/new.ts' })
    assert.deepEqual(change, { path: 'src/new.ts', state: 'untracked', staged: false })
  })

  it('maps unmerged to conflicted', () => {
    const change = entryToChange({ type: 'unmerged', xy: 'UU', path: 'src/conflict.ts' })
    assert.deepEqual(change, { path: 'src/conflict.ts', state: 'conflicted', staged: false })
  })

  it('maps staged modified', () => {
    const change = entryToChange({ type: 'ordinary', xy: 'M.', path: 'src/file.ts' })
    assert.deepEqual(change, { path: 'src/file.ts', state: 'modified', staged: true })
  })

  it('maps unstaged modified', () => {
    const change = entryToChange({ type: 'ordinary', xy: '.M', path: 'src/file.ts' })
    assert.deepEqual(change, { path: 'src/file.ts', state: 'modified', staged: false })
  })

  it('maps rename with origPath', () => {
    const change = entryToChange({ type: 'ordinary', xy: 'R.', path: 'src/new.ts', origPath: 'src/old.ts' })
    assert.deepEqual(change, {
      path: 'src/new.ts',
      state: 'renamed',
      staged: true,
      originalPath: 'src/old.ts',
    })
  })

  it('returns undefined for ignored', () => {
    const change = entryToChange({ type: 'ignored', xy: '!!', path: 'node_modules/foo.js' })
    assert.strictEqual(change, undefined)
  })
})

describe('buildGitStatus', () => {
  it('builds a clean status', () => {
    const output = [
      '# branch.oid abc123',
      '# branch.head main',
      '# branch.ab +0 -0',
    ].join('\0') + '\0'

    const status = buildGitStatus(output, testRepo)
    assert.strictEqual(status.clean, true)
    assert.strictEqual(status.changes.length, 0)
    assert.strictEqual(status.repository, testRepo)
    assert.strictEqual(status.ahead, 0)
    assert.strictEqual(status.behind, 0)
  })

  it('builds a dirty status', () => {
    const output = [
      '# branch.oid abc123',
      '# branch.head main',
      '# branch.ab +1 -2',
      '1 M. N... 100644 100644 100644 abc def src/file.ts',
      '? src/untracked.ts',
    ].join('\0') + '\0'

    const status = buildGitStatus(output, testRepo)
    assert.strictEqual(status.clean, false)
    assert.strictEqual(status.changes.length, 2)
    assert.strictEqual(status.ahead, 1)
    assert.strictEqual(status.behind, 2)
  })
})
