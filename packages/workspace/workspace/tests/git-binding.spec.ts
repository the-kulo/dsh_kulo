import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { SessionHeader, SessionId } from '@deepseek-ai/dsh-session'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import {
  WorkspaceEntity,
  WorkspaceGitRemoteInvalidError,
  WorkspaceGitBranchInvalidError,
  WorkspaceGitUnboundError,
} from '../src/entity.ts'
import type { WorkspaceEntityHost } from '../src/entity.ts'
import type { WorkspaceRecord } from '../src/spec.ts'
import { workspaceRecord } from '../src/spec.ts'
import type { WorkspaceGitBinding } from '../src/types.ts'
import { WorkspaceId } from '../src/index.ts'

import { randomUUID } from 'node:crypto'

/** Build a minimal mock KvTable backed by an in-memory Map. */
function mockTable(): KvTable<string, WorkspaceRecord> {
  const records = new Map<string, WorkspaceRecord>()
  return {
    get(key: string) { return records.get(key) },
    entries(): IterableIterator<[string, WorkspaceRecord]> {
      return records.entries()
    },
    keys(): IterableIterator<string> {
      return records.keys()
    },
    get size() { return records.size },
    async put(key: string, value: WorkspaceRecord) { records.set(key, value) },
    async delete(key: string) {
      const had = records.has(key)
      records.delete(key)
      return had
    },
    async deleteMany(keys: readonly string[]) {
      let count = 0
      for (const key of keys) {
        if (records.delete(key)) count++
      }
      return count
    },
    async update(key: string, fn: (current: WorkspaceRecord) => WorkspaceRecord) {
      const current = records.get(key)
      if (current === undefined) throw new Error(`no record for key '${key}'`)
      const next = fn(current)
      records.set(key, next)
      return next
    },
  }
}

/** Build a minimal mock host with an in-memory table and always-matching candidates. */
function mockHost(): WorkspaceEntityHost {
  const table = mockTable()
  return {
    table: () => table,
    candidateMatches: () => true,
    async readSessionHeader(): Promise<SessionHeader> {
      throw new Error('not implemented in mock')
    },
    rememberSessionPath: () => {},
  }
}

function makeRecord(overrides: Partial<WorkspaceRecord> = {}): WorkspaceRecord {
  return {
    path: '/test/project',
    title: 'Test Project',
    sessionIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeBinding(overrides: Partial<Omit<WorkspaceGitBinding, 'boundAt'>> = {}): Omit<WorkspaceGitBinding, 'boundAt'> {
  return {
    remote: 'git@github.com:org/repo.git',
    branches: ['main'],
    activeBranch: 'main',
    autoCommit: true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Schema tests
// ---------------------------------------------------------------------------
describe('workspaceRecord schema', () => {
  it('parses a record without a git binding (backward-compatible)', () => {
    const old = { path: '/p', title: 'T', sessionIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
    const parsed = workspaceRecord.parse(old)
    assert.equal(parsed.git, undefined)
  })

  it('parses a record with a git binding', () => {
    const withGit = {
      path: '/p', title: 'T', sessionIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      git: { remote: 'git@github.com:org/repo.git', branches: ['main'], activeBranch: 'main', autoCommit: true, boundAt: '2026-06-01T00:00:00.000Z' },
    }
    const parsed = workspaceRecord.parse(withGit)
    assert.deepEqual(parsed.git, {
      remote: 'git@github.com:org/repo.git',
      branches: ['main'],
      activeBranch: 'main',
      autoCommit: true,
      boundAt: '2026-06-01T00:00:00.000Z',
    })
  })
})

// ---------------------------------------------------------------------------
// Entity tests
// ---------------------------------------------------------------------------
describe('WorkspaceEntity git binding', () => {
  it('bindGit stores a binding and returns it with boundAt', async () => {
    const host = mockHost()
    const id = WorkspaceId(randomUUID())
    const record = makeRecord()
    await host.table().put(id, record)
    const entity = new WorkspaceEntity(host, id, record)

    const binding = makeBinding()
    const stored = await entity.bindGit(binding)
    assert.equal(stored.remote, binding.remote)
    assert.deepEqual(stored.branches, [...binding.branches])
    assert.equal(stored.activeBranch, binding.activeBranch)
    assert.equal(stored.autoCommit, binding.autoCommit)
    assert.ok(typeof stored.boundAt === 'string' && stored.boundAt.length > 0)

    // Read back via getter
    assert.deepEqual(entity.git, stored)
  })

  it('bindGit replaces an existing binding', async () => {
    const host = mockHost()
    const id = WorkspaceId(randomUUID())
    const record = makeRecord()
    await host.table().put(id, record)
    const entity = new WorkspaceEntity(host, id, record)

    await entity.bindGit(makeBinding({ remote: 'first' }))
    const second = await entity.bindGit(makeBinding({ remote: 'second', autoCommit: false }))
    assert.equal(second.remote, 'second')
    assert.equal(second.autoCommit, false)
    assert.equal(entity.git?.remote, 'second')
  })

  it('unbindGit removes the binding', async () => {
    const host = mockHost()
    const id = WorkspaceId(randomUUID())
    const record = makeRecord()
    await host.table().put(id, record)
    const entity = new WorkspaceEntity(host, id, record)

    await entity.bindGit(makeBinding())
    assert.ok(entity.git !== undefined)
    await entity.unbindGit()
    assert.equal(entity.git, undefined)
  })

  it('unbindGit is idempotent when unbound', async () => {
    const host = mockHost()
    const id = WorkspaceId(randomUUID())
    const record = makeRecord()
    await host.table().put(id, record)
    const entity = new WorkspaceEntity(host, id, record)

    assert.equal(entity.git, undefined)
    await entity.unbindGit()
    assert.equal(entity.git, undefined)
  })

  it('setGitAutoCommit flips the flag', async () => {
    const host = mockHost()
    const id = WorkspaceId(randomUUID())
    const record = makeRecord()
    await host.table().put(id, record)
    const entity = new WorkspaceEntity(host, id, record)

    await entity.bindGit(makeBinding({ autoCommit: true }))
    assert.equal(entity.git?.autoCommit, true)

    await entity.setGitAutoCommit(false)
    assert.equal(entity.git?.autoCommit, false)

    await entity.setGitAutoCommit(true)
    assert.equal(entity.git?.autoCommit, true)
  })

  it('setGitAutoCommit rejects with WorkspaceGitUnboundError when unbound', async () => {
    const host = mockHost()
    const id = WorkspaceId(randomUUID())
    const record = makeRecord()
    await host.table().put(id, record)
    const entity = new WorkspaceEntity(host, id, record)

    await assert.rejects(
      () => entity.setGitAutoCommit(false),
      WorkspaceGitUnboundError,
    )
  })

  it('setGitBranches keeps the active branch when it stays on the chain', async () => {
    const host = mockHost()
    const id = WorkspaceId(randomUUID())
    const record = makeRecord()
    await host.table().put(id, record)
    const entity = new WorkspaceEntity(host, id, record)

    await entity.bindGit(makeBinding({ branches: ['feature', 'verify', 'stable'], activeBranch: 'feature' }))
    await entity.setGitBranches(['feature', 'verify', 'release'])
    assert.deepEqual(entity.git?.branches, ['feature', 'verify', 'release'])
    assert.equal(entity.git?.activeBranch, 'feature')
  })

  it('setGitBranches falls back to the first entry when the active branch is removed', async () => {
    const host = mockHost()
    const id = WorkspaceId(randomUUID())
    const record = makeRecord()
    await host.table().put(id, record)
    const entity = new WorkspaceEntity(host, id, record)

    await entity.bindGit(makeBinding({ branches: ['feature', 'verify'], activeBranch: 'verify' }))
    await entity.setGitBranches(['main', 'release'])
    assert.equal(entity.git?.activeBranch, 'main')
  })

  it('setGitBranches rejects a chain whose active branch is not a member', async () => {
    const host = mockHost()
    const id = WorkspaceId(randomUUID())
    const record = makeRecord()
    await host.table().put(id, record)
    const entity = new WorkspaceEntity(host, id, record)

    await entity.bindGit(makeBinding({ branches: ['feature', 'verify'], activeBranch: 'feature' }))
    await assert.rejects(
      () => entity.setGitBranches(['main', 'release'], 'verify'),
      WorkspaceGitBranchInvalidError,
    )
  })

  it('setActiveBranch switches within the chain', async () => {
    const host = mockHost()
    const id = WorkspaceId(randomUUID())
    const record = makeRecord()
    await host.table().put(id, record)
    const entity = new WorkspaceEntity(host, id, record)

    await entity.bindGit(makeBinding({ branches: ['feature', 'verify'], activeBranch: 'feature' }))
    await entity.setActiveBranch('verify')
    assert.equal(entity.git?.activeBranch, 'verify')
  })

  it('setActiveBranch rejects a branch outside the chain', async () => {
    const host = mockHost()
    const id = WorkspaceId(randomUUID())
    const record = makeRecord()
    await host.table().put(id, record)
    const entity = new WorkspaceEntity(host, id, record)

    await entity.bindGit(makeBinding({ branches: ['feature', 'verify'], activeBranch: 'feature' }))
    await assert.rejects(
      () => entity.setActiveBranch('other'),
      WorkspaceGitBranchInvalidError,
    )
  })

  it('updatedAt changes on bind', async () => {
    const host = mockHost()
    const id = WorkspaceId(randomUUID())
    const record = makeRecord()
    await host.table().put(id, record)
    const entity = new WorkspaceEntity(host, id, record)

    const before = entity.updatedAt
    // Small delay so the timestamp actually advances
    await new Promise(resolve => setTimeout(resolve, 10))
    await entity.bindGit(makeBinding())
    const after = entity.updatedAt
    assert.notEqual(after, before)
    assert.ok(new Date(after) > new Date(before), 'updatedAt should advance')
  })

  it('updatedAt changes on unbind', async () => {
    const host = mockHost()
    const id = WorkspaceId(randomUUID())
    const record = makeRecord()
    await host.table().put(id, record)
    const entity = new WorkspaceEntity(host, id, record)

    await entity.bindGit(makeBinding())
    const before = entity.updatedAt
    await new Promise(resolve => setTimeout(resolve, 10))
    await entity.unbindGit()
    const after = entity.updatedAt
    assert.notEqual(after, before)
  })

  it('updatedAt changes on setGitAutoCommit', async () => {
    const host = mockHost()
    const id = WorkspaceId(randomUUID())
    const record = makeRecord()
    await host.table().put(id, record)
    const entity = new WorkspaceEntity(host, id, record)

    await entity.bindGit(makeBinding({ autoCommit: true }))
    const before = entity.updatedAt
    await new Promise(resolve => setTimeout(resolve, 10))
    await entity.setGitAutoCommit(false)
    const after = entity.updatedAt
    assert.notEqual(after, before)
  })
})

// ---------------------------------------------------------------------------
// Validation tests
// ---------------------------------------------------------------------------
describe('git binding validation', () => {
  function makeEntity(): { entity: WorkspaceEntity; host: WorkspaceEntityHost } {
    const host = mockHost()
    const id = WorkspaceId(randomUUID())
    const record = makeRecord()
    host.table().put(id, record)
    return { entity: new WorkspaceEntity(host, id, record), host }
  }

  it('rejects an empty remote', async () => {
    const { entity } = makeEntity()
    await assert.rejects(
      () => entity.bindGit(makeBinding({ remote: '' })),
      WorkspaceGitRemoteInvalidError,
    )
  })

  it('rejects a remote with whitespace', async () => {
    const { entity } = makeEntity()
    await assert.rejects(
      () => entity.bindGit(makeBinding({ remote: 'git@github.com:org/repo .git' })),
      WorkspaceGitRemoteInvalidError,
    )
  })

  it('rejects a remote with a newline', async () => {
    const { entity } = makeEntity()
    await assert.rejects(
      () => entity.bindGit(makeBinding({ remote: 'git@github.com:org/repo\n.git' })),
      WorkspaceGitRemoteInvalidError,
    )
  })

  it('rejects a remote with a control character', async () => {
    const { entity } = makeEntity()
    await assert.rejects(
      () => entity.bindGit(makeBinding({ remote: 'git@github.com:\x00org/repo.git' })),
      WorkspaceGitRemoteInvalidError,
    )
  })

  it('rejects an empty branch', async () => {
    const { entity } = makeEntity()
    await assert.rejects(
      () => entity.bindGit(makeBinding({ branches: [''], activeBranch: '' })),
      WorkspaceGitBranchInvalidError,
    )
  })

  it('rejects a branch with ".."', async () => {
    const { entity } = makeEntity()
    await assert.rejects(
      () => entity.bindGit(makeBinding({ branches: ['foo..bar'], activeBranch: 'foo..bar' })),
      WorkspaceGitBranchInvalidError,
    )
  })

  it('rejects a branch with leading dash', async () => {
    const { entity } = makeEntity()
    await assert.rejects(
      () => entity.bindGit(makeBinding({ branches: ['-feature'], activeBranch: '-feature' })),
      WorkspaceGitBranchInvalidError,
    )
  })

  it('rejects a branch with spaces', async () => {
    const { entity } = makeEntity()
    await assert.rejects(
      () => entity.bindGit(makeBinding({ branches: ['feat ure'], activeBranch: 'feat ure' })),
      WorkspaceGitBranchInvalidError,
    )
  })

  it('rejects a branch with tilde', async () => {
    const { entity } = makeEntity()
    await assert.rejects(
      () => entity.bindGit(makeBinding({ branches: ['feat~ure'], activeBranch: 'feat~ure' })),
      WorkspaceGitBranchInvalidError,
    )
  })

  it('rejects a branch with caret', async () => {
    const { entity } = makeEntity()
    await assert.rejects(
      () => entity.bindGit(makeBinding({ branches: ['feat^ure'], activeBranch: 'feat^ure' })),
      WorkspaceGitBranchInvalidError,
    )
  })

  it('rejects a branch with colon', async () => {
    const { entity } = makeEntity()
    await assert.rejects(
      () => entity.bindGit(makeBinding({ branches: ['feat:ure'], activeBranch: 'feat:ure' })),
      WorkspaceGitBranchInvalidError,
    )
  })

  it('rejects a branch with question mark', async () => {
    const { entity } = makeEntity()
    await assert.rejects(
      () => entity.bindGit(makeBinding({ branches: ['feat?ure'], activeBranch: 'feat?ure' })),
      WorkspaceGitBranchInvalidError,
    )
  })

  it('rejects a branch with asterisk', async () => {
    const { entity } = makeEntity()
    await assert.rejects(
      () => entity.bindGit(makeBinding({ branches: ['feat*ure'], activeBranch: 'feat*ure' })),
      WorkspaceGitBranchInvalidError,
    )
  })

  it('rejects a branch with backslash', async () => {
    const { entity } = makeEntity()
    await assert.rejects(
      () => entity.bindGit(makeBinding({ branches: ['fea\\ture'], activeBranch: 'fea\\ture' })),
      WorkspaceGitBranchInvalidError,
    )
  })

  it('rejects a branch with open bracket', async () => {
    const { entity } = makeEntity()
    await assert.rejects(
      () => entity.bindGit(makeBinding({ branches: ['feat[ure'], activeBranch: 'feat[ure' })),
      WorkspaceGitBranchInvalidError,
    )
  })

  it('accepts valid branch names', async () => {
    const { entity } = makeEntity()
    const validBranches = [
      'main',
      'feature/foo-bar',
      'fix/123_bug',
      'release/v1.2.3',
      'dev',
      'a',
      'A_B-C.D@{}',
    ]
    for (const branch of validBranches) {
      const stored = await entity.bindGit(makeBinding({ branches: [branch], activeBranch: branch }))
      assert.equal(stored.activeBranch, branch)
    }
  })
})

// ---------------------------------------------------------------------------
// Persistence round-trip test
// ---------------------------------------------------------------------------
describe('git binding persistence round-trip', () => {
  it('survives a fresh entity loaded from the stored record', async () => {
    const host = mockHost()
    const id = WorkspaceId(randomUUID())
    const record = makeRecord()
    await host.table().put(id, record)

    const entity1 = new WorkspaceEntity(host, id, record)
    const binding = makeBinding({ remote: 'git@github.com:org/repo.git', branches: ['feature/x'], activeBranch: 'feature/x', autoCommit: false })
    const stored = await entity1.bindGit(binding)

    // Simulate reopening: load the record from the table snapshot
    const loaded = host.table().get(id)
    assert.ok(loaded !== undefined, 'stored record must exist')
    const entity2 = new WorkspaceEntity(host, id, loaded!)

    assert.deepEqual(entity2.git, stored)
    assert.equal(entity2.git?.remote, 'git@github.com:org/repo.git')
    assert.equal(entity2.git?.activeBranch, 'feature/x')
    assert.equal(entity2.git?.autoCommit, false)
    assert.equal(entity2.git?.boundAt, stored.boundAt)
  })

  it('loaded entity without git has undefined git', async () => {
    const host = mockHost()
    const id = WorkspaceId(randomUUID())
    const record = makeRecord() // no git
    await host.table().put(id, record)
    const entity = new WorkspaceEntity(host, id, host.table().get(id)!)
    assert.equal(entity.git, undefined)
  })
})
