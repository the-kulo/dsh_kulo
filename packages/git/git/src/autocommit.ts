/**
 * Auto-commit consumer: listens for turn-end events and creates a git commit
 * when the active workspace has a git binding with autoCommit enabled.
 * @module @deepseek-ai/dsh-git
 */

import { realpath } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { Workspace, WorkspaceRegistry } from '@deepseek-ai/dsh-workspace'
import type { WorkspaceGitBinding } from '@deepseek-ai/dsh-workspace/types'

/** Configuration for the auto-commit consumer. */
export interface AutoCommitConfig {
  /** Whether auto-commit is enabled. Default true. */
  enabled: boolean
  /** Debounce window in milliseconds. Default 2000. */
  debounceMs: number
  /** Author name for generated commits. Default 'DeepSeek Harness'. */
  authorName: string
  /** Author email for generated commits. Default 'dsh@localhost'. */
  authorEmail: string
}

/**
 * Install the auto-commit consumer. Observes `session/event` for `turn/end`
 * and creates a git commit when the active workspace has a binding with
 * `autoCommit: true`.
 *
 * Failures are logged and never break the agent turn.
 *
 * @param ctx - Cordis context with `git` and session events.
 * @param workspaceRegistry - The workspace registry for listing workspaces.
 * @param config - Auto-commit configuration.
 * @returns a cleanup function that clears pending debounce timers.
 */
export function installAutoCommit(
  ctx: Context,
  workspaceRegistry: WorkspaceRegistry,
  config: AutoCommitConfig,
): () => void {
  if (!config.enabled) return () => {}

  const pending = new Map<string, ReturnType<typeof setTimeout>>()

  const scheduleCommit = (directory: string, turn: number) => {
    const existing = pending.get(directory)
    if (existing !== undefined) clearTimeout(existing)

    const timer = setTimeout(() => {
      pending.delete(directory)
      void commitTurn(ctx, directory, turn)
    }, config.debounceMs)

    pending.set(directory, timer)
  }

  const off = ctx.on('session/event', (_session: Session, event: SessionEvent) => {
    if (event.type !== 'turn/end') return

    void (async () => {
      try {
        const workspaces = workspaceRegistry.list()
        const cwd = _session.header.cwd
        if (!cwd) return

        let canonicalCwd: string | undefined
        try {
          canonicalCwd = await realpath(cwd)
        } catch (_err: unknown) {
          // Non-existent or otherwise unresolvable cwd — not repo-threatening.
          return
        }

        // Find the workspace matching the session cwd.
        const workspace: Workspace | undefined = workspaces.find(ws => ws.path === canonicalCwd)
        if (!workspace) return

        const binding: WorkspaceGitBinding | undefined = workspace.git
        if (!binding || !binding.autoCommit) return

        const turn = event.data.turn
        scheduleCommit(workspace.path, turn)
      } catch (_error: unknown) {
        // Session cwd canonicalization or workspace listing failed — not repo-threatening.
      }
    })()
  })

  return () => {
    off()
    for (const timer of pending.values()) clearTimeout(timer)
    pending.clear()
  }
}

/**
 * Stage and commit all changes in a workspace directory.
 * @param ctx - Cordis context.
 * @param directory - The absolute workspace path.
 * @param turn - The turn number for the commit message.
 */
async function commitTurn(ctx: Context, directory: string, turn: number): Promise<void> {
  try {
    const status = await ctx.git.status(directory)
    if (!status) return
    if (status.clean) return

    const n = status.changes.length
    const message = `dsh: turn ${turn} — ${n} file(s) changed`
    await ctx.git.commit({ directory, message })
  } catch (error: unknown) {
    ctx.logger.warn(`git auto-commit failed for ${directory}: ${String(error)}`)
  }
}
