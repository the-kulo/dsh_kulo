/**
 * Secure-zone isolation for filesystem tool targets.
 *
 * The isolation is symmetric: a secure-zone session cannot reach the workspace,
 * and a workspace session cannot reach the secure zone. It holds for every
 * sandbox mode, including `danger-full-access`, and restricts nothing else, so
 * the rest of the workspace keeps the permissions its sandbox mode grants.
 *
 * @module @deepseek-ai/dsh-tool-fs/secure-zone
 */

import type { Context } from '@deepseek-ai/cordis'
import type { FsTarget } from '@deepseek-ai/dsh-fs'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
// Type-only: the `ctx.fsZones` merge from the zone service package.
import type {} from '@deepseek-ai/dsh-fs-zones'

/**
 * Reject `target` when it crosses the secure-zone boundary for `exec`'s session.
 *
 * Does nothing when the zone service is not loaded.
 *
 * @param ctx - Plugin context carrying the optional `fsZones` service.
 * @param exec - Tool execution whose session decides which side of the boundary it may reach.
 * @param target - Resolved filesystem target the tool is about to touch.
 * @param _cwd - Unused; kept so existing call sites need no change.
 * @returns A promise that rejects with `FS_ZONE_DENIED` on a boundary crossing.
 */
export async function assertSecureZoneTarget(
  ctx: Context,
  exec: ToolExecution,
  target: FsTarget,
  _cwd?: string,
): Promise<void> {
  await ctx.get('fsZones')?.assertTarget(exec, target)
}
