import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import type {
  SubprocessHandle,
  SubprocessOutputReader,
  SubprocessOutcome,
  SubprocessSpawnSpec,
  SubprocessTerminalEnvironment,
  SubprocessTerminalHandle,
  SubprocessTerminalSpawnSpec,
} from '@deepseek-ai/dsh-subprocess'
import { LocalGitService } from '../src/local.ts'
import { GitArgumentError, GitCommandError } from '../src/types.ts'

/** One scripted `git` invocation result, returned in spawn order. */
interface ScriptedRun {
  exitCode: number
  stdout?: string
  stderr?: string
}

/**
 * Subprocess runtime whose spawns return scripted outcomes in order, so
 * {@link LocalGitService.log} is testable without spawning real processes.
 */
class ScriptedSubprocess extends SubprocessRuntime {
  // Public: the Cordis service proxy forwards public fields but not `#private` ones.
  readonly runs: readonly ScriptedRun[]
  cursor = 0

  constructor(ctx: Context, runs: readonly ScriptedRun[]) {
    super(ctx)
    this.runs = runs
  }

  resolveExecutable(): Promise<string> {
    return Promise.resolve('git')
  }

  terminalEnvironment(): Promise<SubprocessTerminalEnvironment> {
    return Promise.resolve({ platform: 'posix' })
  }

  spawn(spec: SubprocessSpawnSpec): SubprocessHandle {
    void spec
    const run = this.runs[this.cursor]
    this.cursor += 1
    if (!run) throw new Error('no scripted run left')

    const outcome: SubprocessOutcome = { exitCode: run.exitCode, signal: null }
    const reader = (text: string): SubprocessOutputReader => ({
      readFrom: () => ({ text, nextOffset: text.length, lossy: false }),
    })
    return {
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
      control: undefined,
      collected: {
        stdout: reader(run.stdout ?? ''),
        stderr: reader(run.stderr ?? ''),
      },
      done: Promise.resolve(outcome),
      terminate() {},
      waitForExit: () => Promise.resolve(true),
    }
  }

  spawnTerminal(_spec: SubprocessTerminalSpawnSpec): Promise<SubprocessTerminalHandle> {
    return Promise.reject(new Error('terminals are not scripted in this test'))
  }
}

function makeService(runs: readonly ScriptedRun[]): LocalGitService {
  const ctx = new Context()
  new ScriptedSubprocess(ctx, runs)
  return new LocalGitService(ctx, {
    timeoutMs: 5_000,
    outputMaxBytes: 1024 * 1024,
    stderrTailBytes: 16_384,
    terminateGraceMs: 2_000,
    authorName: 'DeepSeek Harness',
    authorEmail: 'dsh@localhost',
  }, 'git')
}

describe('LocalGitService.log', () => {
  it('returns commits for a repository with history', async () => {
    const service = makeService([{
      exitCode: 0,
      stdout: 'f0e1d2c3b4a5968778695a4b3c2d1e0f19283746\u0000f0e1d2c\u0000initial commit\u0000Probe\u00002026-11-10T12:00:00+08:00\n',
    }])

    const commits = await service.log('/repo', 10)
    assert.equal(commits.length, 1)
    assert.equal(commits[0]!.oid, 'f0e1d2c3b4a5968778695a4b3c2d1e0f19283746')
    assert.equal(commits[0]!.message, 'initial commit')
  })

  it('returns [] for an empty repository', async () => {
    // Real `git log` failure on a repo whose HEAD branch has no commits.
    const service = makeService([{
      exitCode: 128,
      stderr: "fatal: your current branch 'main' does not have any commits yet\n",
    }])

    const commits = await service.log('/repo', 10)
    assert.deepEqual(commits, [])
  })

  it('throws GitCommandError for a genuine failure', async () => {
    const service = makeService([{
      exitCode: 128,
      stderr: 'fatal: not a git repository (or any of the parent directories): .git\n',
    }])

    await assert.rejects(service.log('/repo', 10), (error: unknown) => {
      assert.ok(error instanceof GitCommandError)
      assert.equal(error.exitCode, 128)
      return true
    })
  })
})

describe('LocalGitService.bind validation', () => {
  const validRequest = { directory: '/tmp/repo', remote: 'git@github.com:org/repo.git', branch: 'main' }

  function serviceForBind(): LocalGitService {
    const ctx = new Context()
    new ScriptedSubprocess(ctx, [
      // discover: rev-parse fails → no existing repo
      { exitCode: 128, stderr: 'fatal: not a git repository\n' },
      // init
      { exitCode: 0 },
      // remote add
      { exitCode: 0 },
      // rev-parse --verify HEAD (empty repo)
      { exitCode: 128 },
      // symbolic-ref
      { exitCode: 0 },
      // re-discover
      { exitCode: 0, stdout: '/tmp/repo\n/tmp/repo/.git\n' },
      // currentBranch
      { exitCode: 0, stdout: 'main\n' },
      // originUrl
      { exitCode: 0, stdout: 'git@github.com:org/repo.git\n' },
    ])
    return new LocalGitService(ctx, {
      timeoutMs: 5_000,
      outputMaxBytes: 1024 * 1024,
      stderrTailBytes: 16_384,
      terminateGraceMs: 2_000,
      authorName: 'DeepSeek Harness',
      authorEmail: 'dsh@localhost',
    }, 'git')
  }

  it('rejects a branch containing ".."', async () => {
    const svc = serviceForBind()
    await assert.rejects(
      svc.bind({ ...validRequest, branch: 'foo..bar' }),
      (err: unknown) => err instanceof GitArgumentError && err.message.includes('branch'),
    )
  })

  it('rejects a branch starting with "-"', async () => {
    const svc = serviceForBind()
    await assert.rejects(
      svc.bind({ ...validRequest, branch: '-evil' }),
      (err: unknown) => err instanceof GitArgumentError && err.message.includes('branch'),
    )
  })

  it('rejects a branch with whitespace', async () => {
    const svc = serviceForBind()
    await assert.rejects(
      svc.bind({ ...validRequest, branch: 'bad branch' }),
      (err: unknown) => err instanceof GitArgumentError && err.message.includes('branch'),
    )
  })

  it('rejects a branch with forbidden ref characters', async () => {
    const svc = serviceForBind()
    await assert.rejects(
      svc.bind({ ...validRequest, branch: 'bad~name' }),
      (err: unknown) => err instanceof GitArgumentError && err.message.includes('branch'),
    )
  })
})
