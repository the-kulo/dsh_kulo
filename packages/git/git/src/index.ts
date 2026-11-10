/**
 * Git capability seam: Service Definition, local provider, and auto-commit
 * consumer. Binds a workspace folder to a remote git address, reports the
 * working tree in the right-sidebar git tree, and auto-generates commits for
 * each change.
 * @module @deepseek-ai/dsh-git
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-session'
import type { WorkspaceRegistry } from '@deepseek-ai/dsh-workspace'
import { installAutoCommit } from './autocommit.ts'
import type { AutoCommitConfig } from './autocommit.ts'
import { LocalGitService, resolveGitExecutable } from './local.ts'

// Re-export the types for consumers.
export type {
  GitBindRequest,
  GitCommit,
  GitCommitRequest,
  GitCommitResult,
  GitFileChange,
  GitFileState,
  GitRepository,
  GitStatus,
} from './types.ts'

export {
  GitArgumentError,
  GitCommandError,
  GitNotRepositoryError,
  GitUnavailableError,
} from './types.ts'

export { GitService } from './service.ts'
export { LocalGitService } from './local.ts'
export type { LocalGitConfig } from './local.ts'
export type { AutoCommitConfig } from './autocommit.ts'

/** Stable Loader identity. */
export const name = 'git'

/**
 * Services used by this plugin. The `workspaceRegistry` is an optional
 * dependency resolved dynamically via `ctx.get()`; it is required only when
 * `autoCommit.enabled` is true.
 */
export const inject = ['subprocess']

/** Plugin configuration schema. */
export interface Config {
  /** Path or name of the git executable. Default `'git'`. */
  executable: string
  /** Milliseconds one git command may run. Default 30000. */
  timeoutMs: number
  /** In-memory stdout cap in bytes. Default 8 MiB. */
  outputMaxBytes: number
  /** Retained stderr tail in bytes for diagnostics. Default 16384. */
  stderrTailBytes: number
  /** Grace period in milliseconds for git child termination. Default 2000. */
  terminateGraceMs: number
  /** Auto-commit consumer configuration. */
  autoCommit: AutoCommitConfig
}

/** Schemastery validation for {@link Config}. */
export const Config: z<Config> = z.object({
  executable: z.string().default('git'),
  timeoutMs: z.number().default(30_000),
  outputMaxBytes: z.number().default(8 * 1024 * 1024),
  stderrTailBytes: z.number().default(16_384),
  terminateGraceMs: z.number().default(2_000),
  autoCommit: z.object({
    enabled: z.boolean().default(true),
    debounceMs: z.number().default(2_000),
    authorName: z.string().default('DeepSeek Harness'),
    authorEmail: z.string().default('dsh@localhost'),
  }),
})

/**
 * Apply the git plugin: resolve the git executable, register the git service,
 * and install the auto-commit consumer when enabled.
 * @param ctx - Host context with `subprocess`.
 * @param config - Validated bounds.
 */
export function apply(ctx: Context, config: Config): void {
  // Validate config bounds.
  for (const [field, value] of [
    ['timeoutMs', config.timeoutMs],
    ['outputMaxBytes', config.outputMaxBytes],
    ['stderrTailBytes', config.stderrTailBytes],
    ['terminateGraceMs', config.terminateGraceMs],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error(`dsh-git requires a positive integer ${field}`)
    }
  }

  if (!Number.isSafeInteger(config.autoCommit.debounceMs) || config.autoCommit.debounceMs < 1) {
    throw new Error('dsh-git requires a positive integer autoCommit.debounceMs')
  }

  // Resolve optional workspaceRegistry for auto-commit.
  const workspaceRegistry: WorkspaceRegistry | undefined = ctx.get('workspaceRegistry')
  if (config.autoCommit.enabled && workspaceRegistry === undefined) {
    throw new Error('dsh-git: autoCommit requires the workspaceRegistry service')
  }

  const lifetime = new AbortController()
  let cleanupAutocommit: (() => void) | undefined
  let disposed = false

  ctx.effect(() => async () => {
    disposed = true
    lifetime.abort()
    cleanupAutocommit?.()
  })

  // Resolve the git executable.
  resolveGitExecutable(ctx, ctx.subprocess, { executable: config.executable }, lifetime.signal).then((executable) => {
    if (disposed) return
    if (executable === null) {
      ctx.logger.info('dsh-git: git executable is not available; git operations will throw GitUnavailableError')
    }

    // The Service base constructor registers `ctx.git`; providing it again throws.
    new LocalGitService(ctx, {
      timeoutMs: config.timeoutMs,
      outputMaxBytes: config.outputMaxBytes,
      stderrTailBytes: config.stderrTailBytes,
      terminateGraceMs: config.terminateGraceMs,
      authorName: config.autoCommit.authorName,
      authorEmail: config.autoCommit.authorEmail,
    }, executable)

    // Install auto-commit consumer if enabled.
    if (config.autoCommit.enabled) {
      cleanupAutocommit = installAutoCommit(ctx, workspaceRegistry!, config.autoCommit)
    }
  }).catch((error: unknown) => {
    if (disposed) return
    ctx.logger.warn(`dsh-git: failed to resolve git executable: ${String(error)}`)
  })
}
