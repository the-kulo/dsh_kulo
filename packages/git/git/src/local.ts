/**
 * Local git provider: runs the resolved git executable through the subprocess
 * capability with bounded output, timeouts, and cancellation.
 * @module @deepseek-ai/dsh-git
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import type { GitCommit } from './types.ts'
import {
  GitArgumentError,
  GitCommandError,
  GitNotRepositoryError,
  GitPromotionConflictError,
  GitUnavailableError,
} from './types.ts'
import type {
  GitBindRequest,
  GitCheckoutRequest,
  GitCommitRequest,
  GitCommitResult,
  GitPromoteRequest,
  GitRepository,
  GitStatus,
} from './types.ts'
import { buildGitStatus } from './porcelain.ts'
import { GitService } from './service.ts'

/** Settled subprocess facts. */
interface RunResult {
  exitCode: number | null
  stdout: string
  stderr: string
}

/**
 * Run a git command through the subprocess capability.
 * @param subprocess - The subprocess runtime.
 * @param executable - Resolved git executable path.
 * @param args - git arguments; never shell-interpreted.
 * @param cwd - Working directory.
 * @param timeoutMs - Command timeout in milliseconds.
 * @param outputMaxBytes - Stdout byte cap.
 * @param stderrTailBytes - Stderr byte cap for diagnostics.
 * @param terminateGraceMs - Grace period in milliseconds for git child termination.
 * @param signal - Cancellation signal.
 * @returns the settled command facts.
 * @throws {@link GitCommandError} when the command fails.
 */
async function runGit(
  subprocess: SubprocessRuntime,
  executable: string,
  args: readonly string[],
  cwd: string,
  timeoutMs: number,
  outputMaxBytes: number,
  stderrTailBytes: number,
  terminateGraceMs: number,
  signal: AbortSignal | undefined,
): Promise<RunResult> {
  const timeout = AbortSignal.timeout(timeoutMs)
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout

  const handle = subprocess.spawn({
    argv: [executable, ...args],
    cwd,
    stdio: {
      stdin: 'ignore',
      stdout: { maxBytes: outputMaxBytes },
      stderr: { maxBytes: stderrTailBytes },
    },
    graceMs: terminateGraceMs,
    signal: combinedSignal,
    env: { GIT_CONFIG_COUNT: '0', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' },
  })

  const outcome = await handle.done

  if (combinedSignal.aborted) {
    throw errorFromAbort(args, timeout)
  }

  const stdout = handle.collected.stdout?.readFrom(0).text ?? ''
  const stderr = handle.collected.stderr?.readFrom(0).text ?? ''

  return { exitCode: outcome.exitCode, stdout, stderr }
}

function errorFromAbort(args: readonly string[], timeout: AbortSignal): Error {
  if (timeout.aborted) {
    return new GitCommandError([...args], null, 'timed out')
  }
  return new GitCommandError([...args], null, 'aborted')
}

/**
 * Run git and throw on non-zero exit.
 * @returns the settled facts.
 */
async function gitOrThrow(
  subprocess: SubprocessRuntime,
  executable: string,
  args: readonly string[],
  cwd: string,
  timeoutMs: number,
  outputMaxBytes: number,
  stderrTailBytes: number,
  terminateGraceMs: number,
  signal: AbortSignal | undefined,
): Promise<RunResult> {
  const result = await runGit(subprocess, executable, args, cwd, timeoutMs, outputMaxBytes, stderrTailBytes, terminateGraceMs, signal)
  if (result.exitCode !== 0) {
    throw new GitCommandError([...args], result.exitCode, result.stderr)
  }
  return result
}

/** Configuration for the local git provider. */
export interface LocalGitConfig {
  /** Milliseconds one git command may run. Default 30000. */
  timeoutMs: number
  /** In-memory stdout cap in bytes. Default 8 MiB. */
  outputMaxBytes: number
  /** Retained stderr tail in bytes for diagnostics. Default 16384. */
  stderrTailBytes: number
  /** Grace period in milliseconds for git child termination. Default 2000. */
  terminateGraceMs: number
  /** Commit author name. Default 'DeepSeek Harness'. */
  authorName: string
  /** Commit author email. Default 'dsh@localhost'. */
  authorEmail: string
}

/**
 * Resolve the git executable once at plugin load.
 * On a non-abort failure, logs a warning and returns null so the service
 * reports {@link GitUnavailableError}. On abort, returns null silently.
 *
 * @param ctx - Cordis context for logging.
 * @param subprocess - The subprocess runtime.
 * @param config - Executable selection.
 * @param signal - Plugin lifetime.
 * @returns the executable path, or null when git is absent.
 */
export async function resolveGitExecutable(
  ctx: Context,
  subprocess: SubprocessRuntime,
  config: { executable: string },
  signal: AbortSignal,
): Promise<string | null> {
  try {
    return await subprocess.resolveExecutable(config.executable, undefined, signal)
  } catch (error: unknown) {
    if (signal.aborted) return null
    ctx.logger.warn(`dsh-git: failed to resolve git executable: ${String(error)}`)
    return null
  }
}

/**
 * Characters forbidden in git branch names by the workspace entity's ref rules.
 * Mirrors the same set used in workspace validation.
 */
// eslint-disable-next-line no-control-regex
const FORBIDDEN_BRANCH_RE = /[\x00-\x1f\x7f~^:?*[\\]/

/**
 * Local git provider. Runs the resolved git executable through the subprocess
 * capability.
 */
export class LocalGitService extends GitService {
  readonly #subprocess: SubprocessRuntime
  readonly #executable: string | null
  readonly #config: LocalGitConfig

  /**
   * @param ctx - Cordis context.
   * @param config - Validated provider bounds.
   * @param executable - Resolved git path, or null when git is absent.
   */
  constructor(
    ctx: import('@deepseek-ai/cordis').Context,
    config: LocalGitConfig,
    executable: string | null,
  ) {
    super(ctx)
    this.#subprocess = ctx.subprocess
    this.#config = config
    this.#executable = executable
  }

  /** Throw when git is unavailable. */
  #requireExecutable(): string {
    if (this.#executable === null) {
      throw new GitUnavailableError()
    }
    return this.#executable
  }

  /** @inheritdoc */
  async discover(directory: string, signal?: AbortSignal): Promise<GitRepository | undefined> {
    const exe = this.#requireExecutable()
    const result = await runGit(
      this.#subprocess, exe,
      ['rev-parse', '--show-toplevel', '--absolute-git-dir'],
      directory, this.#config.timeoutMs, this.#config.outputMaxBytes,
      this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
    )
    if (result.exitCode !== 0) return undefined

    const lines = result.stdout.trim().split('\n')
    const root = lines[0]!
    const gitDir = lines[1]!

    // Get branch and remote
    const branch = await this.#currentBranch(exe, directory, signal)
    const remote = await this.#originUrl(exe, directory, signal)

    return { root, gitDir, branch, remote }
  }

  async #currentBranch(exe: string, cwd: string, signal?: AbortSignal): Promise<string> {
    try {
      const result = await runGit(
        this.#subprocess, exe,
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        cwd, this.#config.timeoutMs, this.#config.outputMaxBytes,
        this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
      )
      // Detached HEAD or unborn branch — rev-parse --abbrev-ref HEAD returns "HEAD"
      return result.stdout.trim() || 'HEAD'
    } catch {
      return 'HEAD'
    }
  }

  async #originUrl(exe: string, cwd: string, signal?: AbortSignal): Promise<string | undefined> {
    try {
      const result = await gitOrThrow(
        this.#subprocess, exe,
        ['remote', 'get-url', 'origin'],
        cwd, this.#config.timeoutMs, this.#config.outputMaxBytes,
        this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
      )
      return result.stdout.trim() || undefined
    } catch {
      return undefined
    }
  }

  /** @inheritdoc */
  async bind(request: GitBindRequest, signal?: AbortSignal): Promise<GitRepository> {
    const exe = this.#requireExecutable()

    // Reject remote URL with whitespace.
    if (/\s/.test(request.remote)) {
      throw new GitArgumentError('remote URL must not contain whitespace')
    }

    // Validate branch name: mirror the workspace entity's forbidden git-ref rules.
    if (
      request.branch.includes('..') ||
      request.branch.startsWith('-') ||
      /\s/.test(request.branch) ||
      FORBIDDEN_BRANCH_RE.test(request.branch)
    ) {
      throw new GitArgumentError('branch name contains forbidden characters')
    }

    // Check if the directory is already a repo.
    const existing = await this.discover(request.directory, signal)
    const root = existing?.root ?? request.directory

    if (!existing) {
      // Initialize git.
      await gitOrThrow(
        this.#subprocess, exe,
        ['init'],
        request.directory, this.#config.timeoutMs, this.#config.outputMaxBytes,
        this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
      )
    }

    // Configure origin remote.
    const hasOrigin = existing?.remote !== undefined
    if (hasOrigin) {
      await gitOrThrow(
        this.#subprocess, exe,
        ['remote', 'set-url', 'origin', request.remote],
        root, this.#config.timeoutMs, this.#config.outputMaxBytes,
        this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
      )
    } else {
      await gitOrThrow(
        this.#subprocess, exe,
        ['remote', 'add', 'origin', request.remote],
        root, this.#config.timeoutMs, this.#config.outputMaxBytes,
        this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
      )
    }

    // Check out the branch.
    const branchResult = await runGit(
      this.#subprocess, exe,
      ['rev-parse', '--verify', 'HEAD'],
      root, this.#config.timeoutMs, this.#config.outputMaxBytes,
      this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
    )

    if (branchResult.exitCode === 0) {
      // Repo has commits: checkout -B.
      await gitOrThrow(
        this.#subprocess, exe,
        ['checkout', '-B', request.branch],
        root, this.#config.timeoutMs, this.#config.outputMaxBytes,
        this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
      )
    } else {
      // Empty repo: use symbolic-ref to set HEAD.
      await gitOrThrow(
        this.#subprocess, exe,
        ['symbolic-ref', 'HEAD', `refs/heads/${request.branch}`],
        root, this.#config.timeoutMs, this.#config.outputMaxBytes,
        this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
      )
    }

    // Re-discover to return the complete repository.
    const repo = await this.discover(root, signal)
    if (!repo) {
      throw new GitNotRepositoryError(root)
    }

    this.ctx.emit('git/changed', { directory: root })
    return repo
  }

  /** @inheritdoc */
  async status(directory: string, signal?: AbortSignal): Promise<GitStatus | undefined> {
    const exe = this.#requireExecutable()

    // First discover the repo
    const repo = await this.discover(directory, signal)
    if (!repo) return undefined

    // Run status
    const result = await gitOrThrow(
      this.#subprocess, exe,
      ['status', '--porcelain=v2', '--branch', '-z'],
      repo.root, this.#config.timeoutMs, this.#config.outputMaxBytes,
      this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
    )

    return buildGitStatus(result.stdout, repo)
  }

  /** @inheritdoc */
  async commit(request: GitCommitRequest, signal?: AbortSignal): Promise<GitCommitResult> {
    const exe = this.#requireExecutable()

    // Stage all changes.
    await gitOrThrow(
      this.#subprocess, exe,
      ['add', '--all', '--ignore-errors'],
      request.directory, this.#config.timeoutMs, this.#config.outputMaxBytes,
      this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
    )

    // Check if anything is staged.
    const statusResult = await gitOrThrow(
      this.#subprocess, exe,
      ['status', '--porcelain'],
      request.directory, this.#config.timeoutMs, this.#config.outputMaxBytes,
      this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
    )

    if (statusResult.stdout.trim() === '') {
      return { committed: false }
    }

    // Commit with identity overrides.
    await gitOrThrow(
      this.#subprocess, exe,
      ['-c', `user.name=${this.#config.authorName}`, '-c', `user.email=${this.#config.authorEmail}`, 'commit', '-m', request.message],
      request.directory, this.#config.timeoutMs, this.#config.outputMaxBytes,
      this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
    )

    // Read the commit we just created.
    const logResult = await gitOrThrow(
      this.#subprocess, exe,
      ['log', '--format=%H%x00%h%x00%s%x00%an%x00%aI', '-n', '1'],
      request.directory, this.#config.timeoutMs, this.#config.outputMaxBytes,
      this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
    )

    const commit = this.#parseLogLine(logResult.stdout.trim())
    if (!commit) {
      return { committed: false }
    }

    this.ctx.emit('git/committed', { directory: request.directory, commit })
    this.ctx.emit('git/changed', { directory: request.directory })
    return { committed: true, commit }
  }

  /** @inheritdoc */
  async log(directory: string, limit: number, signal?: AbortSignal): Promise<readonly GitCommit[]> {
    const exe = this.#requireExecutable()

    const args = ['log', '--format=%H%x00%h%x00%s%x00%an%x00%aI', '-n', String(limit)]
    const result = await runGit(
      this.#subprocess, exe,
      args, directory, this.#config.timeoutMs, this.#config.outputMaxBytes,
      this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
    )

    if (result.exitCode === 0) {
      if (result.stdout.trim() === '') return []
      return this.#parseLogOutput(result.stdout)
    }

    // Empty repository: git log exits 128 before the first commit. LC_ALL=C in
    // runGit pins this message; any other failure still throws.
    if (result.stderr.includes('does not have any commits yet')) return []

    throw new GitCommandError([...args], result.exitCode, result.stderr)
  }

  /** @inheritdoc */
  async listBranches(directory: string, signal?: AbortSignal): Promise<readonly string[]> {
    const exe = this.#requireExecutable()
    const args = ['branch', '--format=%(refname:short)']
    const result = await runGit(
      this.#subprocess, exe, args,
      directory, this.#config.timeoutMs, this.#config.outputMaxBytes,
      this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
    )
    if (result.exitCode !== 0) {
      // Empty repository: git branch exits 128 before the first commit.
      if (result.stderr.includes('does not have any commits yet')) return []
      throw new GitCommandError(args, result.exitCode, result.stderr)
    }
    return result.stdout.split('\n').map(line => line.trim()).filter(line => line !== '')
  }

  /** @inheritdoc */
  async checkout(request: GitCheckoutRequest, signal?: AbortSignal): Promise<GitRepository> {
    const exe = this.#requireExecutable()
    const branches = await this.listBranches(request.directory, signal)
    const args = branches.includes(request.branch)
      ? ['checkout', request.branch]
      : ['checkout', '-b', request.branch]
    await gitOrThrow(
      this.#subprocess, exe, args,
      request.directory, this.#config.timeoutMs, this.#config.outputMaxBytes,
      this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
    )
    this.ctx.emit('git/changed', { directory: request.directory })
    const repository = await this.discover(request.directory, signal)
    if (repository === undefined) throw new GitNotRepositoryError(request.directory)
    return repository
  }

  /** @inheritdoc */
  async promote(request: GitPromoteRequest, signal?: AbortSignal): Promise<GitRepository> {
    const exe = this.#requireExecutable()
    const branches = await this.listBranches(request.directory, signal)
    if (branches.includes(request.to)) {
      await gitOrThrow(
        this.#subprocess, exe, ['checkout', request.to],
        request.directory, this.#config.timeoutMs, this.#config.outputMaxBytes,
        this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
      )
    } else {
      // Create the target at the source's commit, then the merge below is a no-op.
      await gitOrThrow(
        this.#subprocess, exe, ['checkout', '-b', request.to, request.from],
        request.directory, this.#config.timeoutMs, this.#config.outputMaxBytes,
        this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
      )
    }
    try {
      await gitOrThrow(
        this.#subprocess, exe, ['merge', '--no-edit', request.from],
        request.directory, this.#config.timeoutMs, this.#config.outputMaxBytes,
        this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
      )
    } catch (error) {
      // The merge conflicted: restore the pre-promotion branch and report.
      await runGit(
        this.#subprocess, exe, ['merge', '--abort'],
        request.directory, this.#config.timeoutMs, this.#config.outputMaxBytes,
        this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
      )
      await runGit(
        this.#subprocess, exe, ['checkout', request.from],
        request.directory, this.#config.timeoutMs, this.#config.outputMaxBytes,
        this.#config.stderrTailBytes, this.#config.terminateGraceMs, signal,
      )
      const stderr = error instanceof GitCommandError ? error.stderr : String(error)
      throw new GitPromotionConflictError(request, stderr)
    }
    this.ctx.emit('git/changed', { directory: request.directory })
    const repository = await this.discover(request.directory, signal)
    if (repository === undefined) throw new GitNotRepositoryError(request.directory)
    return repository
  }

  #parseLogOutput(output: string): GitCommit[] {
    const commits: GitCommit[] = []
    for (const line of output.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === '') continue
      const commit = this.#parseLogLine(trimmed)
      if (commit) commits.push(commit)
    }
    return commits
  }

  #parseLogLine(line: string): GitCommit | undefined {
    const parts = line.split('\0')
    if (parts.length < 5) return undefined
    return {
      oid: parts[0]!,
      shortOid: parts[1]!,
      message: parts[2]!,
      author: parts[3]!,
      timestamp: parts[4]!,
    }
  }
}
