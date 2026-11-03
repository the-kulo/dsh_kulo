/**
 * Secure-zone path containment for the filesystem tools. A Session created
 * into the dedicated `secure` zone may only touch files inside its zone
 * directory (its current directory); the filesystem backend resolves absolute
 * paths without a cwd constraint, so this guard re-asserts the zone boundary
 * per call for every read/write/edit target. The check runs in trusted tool
 * code over a model-controlled path, mirroring the fs-sandbox's
 * canonicalize-then-contain posture: resolve both the zone root and the target
 * through `ctx.fs`, then require `ctx.fs.contains`.
 * @module @deepseek-ai/dsh-tool-fs/secure-zone
 */

import type { Context } from '@deepseek-ai/cordis'
import type { FsTarget } from '@deepseek-ai/dsh-fs'
import { FsError } from '@deepseek-ai/dsh-fs'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
// Type-only: the `ctx.sessionProjections` merge plus the `zone` projection key.
import type {} from '@deepseek-ai/dsh-session-projection'

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Dedicated sidebar zone the Session belongs to; null for ordinary Sessions. */
    zone: 'quick-qa' | 'secure' | null
  }
}

/**
 * Whether the executing Session belongs to the dedicated secure zone. Unknown
 * (a non-agent call, no `sessionProjections` service, or a composition without
 * the `zone` projection) reads as not secure, preserving ordinary Sessions'
 * unsandboxed behavior.
 * @param ctx - context that may carry the `sessionProjections` service.
 * @param exec - the tool execution whose owning Session is inspected.
 * @returns true only for a `secure`-zone Session.
 */
export function isSecureZone(ctx: Context, exec: ToolExecution): boolean {
  if (exec.agent === undefined) return false
  const projections = ctx.get('sessionProjections')
  if (projections === undefined) return false
  return projections.snapshot(exec.agent.session, ['zone']).values.zone === 'secure'
}

/**
 * Assert that a resolved filesystem target lies under the Session's zone
 * directory. Non-secure Sessions and non-agent calls pass through unchanged; a
 * secure target outside the zone throws the structured `FS_SANDBOX_DENIED`.
 * @param ctx - the filesystem tool context.
 * @param exec - the tool execution; supplies the owning Session.
 * @param target - the already-resolved target to contain.
 * @param cwd - the Session current directory (the zone directory for a secure
 *   Session), already resolved by the caller through `workingDirectory`.
 * @returns after the containment check passes.
 */
export async function assertSecureZoneTarget(
  ctx: Context,
  exec: ToolExecution,
  target: FsTarget,
  cwd: string | undefined,
): Promise<void> {
  if (!isSecureZone(ctx, exec) || cwd === undefined) return
  const root = await ctx.fs.resolve(cwd, { signal: exec.signal })
  if (!ctx.fs.contains(root, target)) {
    throw new FsError(
      `cannot access "${target.displayPath}": secure-zone sessions may only read and write files inside their zone directory`,
      'FS_SANDBOX_DENIED',
    )
  }
}
