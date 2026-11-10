/**
 * The writable-root derivation shared by every enforcement dialect that
 * expresses a mode as a canonical allow-list: `workspace-write` means "the
 * workspace root, explicit extra directories, and platform temp areas", and this module is that
 * meaning's one home. The Seatbelt profile
 * (`@deepseek-ai/dsh-sandbox-local`) and the in-process filesystem fence
 * (`@deepseek-ai/dsh-fs-sandbox`) both derive their allow-list here, so "the
 * write tool cannot write /tmp but bash can" asymmetries cannot arise between
 * them. The bwrap and Landlock dialects keep their own grant spellings (an
 * ephemeral `/tmp` mount, launcher-owned flags) — the honest per-runner
 * differences recorded in the sandbox RFC — with parity pinned by test.
 *
 * The policy's `excludedRoots` are subtracted from the result: a root that
 * lies entirely inside an excluded directory never enters the allow-list, and
 * the workspace root is kept even when it contains one, because a grant
 * grammar that can only add paths cannot express "everything except this
 * subtree". Callers therefore enforce the leftover hole themselves — the fs
 * fence rejects a target inside an exclusion regardless of mode, which is what
 * keeps the zone boundary intact under `danger-full-access`.
 *
 * @module dsh-sandbox/roots
 */

import { realpathSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, relative, resolve } from 'node:path'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import type { SandboxExecutionPolicy } from './index.ts'

/** An explicit directory grant cannot be enforced without changing the caller's selected path. */
export class SandboxInvalidRootError extends HarnessError {
  constructor(path: string, detail: string) {
    super(`Invalid additional writable directory ${JSON.stringify(path)}: ${detail}`, 'SANDBOX_INVALID_ROOT')
    this.name = 'SandboxInvalidRootError'
  }
}

/** Reject mutable path aliases before they can redirect an explicit grant. */
function additionalRoot(path: string): string {
  let physical: string
  let directory: boolean
  try {
    physical = realpathSync.native(path)
    directory = statSync(physical).isDirectory()
  } catch (error) {
    throw new SandboxInvalidRootError(path, `cannot read the directory: ${String(error)}`)
  }
  if (!directory) throw new SandboxInvalidRootError(path, 'expected an existing directory')
  if (physical !== resolve(path)) {
    throw new SandboxInvalidRootError(path, `use the physical directory path ${JSON.stringify(physical)}; symlinked grants are not supported`)
  }
  return physical
}

/**
 * Resolve a granted root to the path the enforcement layer actually compares:
 * canonical (symlinks resolved), because both Seatbelt filters and the fs
 * fence's containment check match resolved paths — `/tmp` IS `/private/tmp`
 * on darwin, and an as-spelled grant would match nothing.
 * @param path - the root as configured or platform-reported.
 * @returns the canonical path, or the spelling as-is when resolution fails
 *   (a missing root matches nothing until it exists — the conservative
 *   outcome; inventing a fallback would grant a path the caller never named).
 */
export function canonicalPath(path: string): string {
  try {
    // Node's JavaScript realpath implementation lexically collapses `..`
    // before resolving a preceding symlink on some platforms. The native
    // implementation follows the filesystem's component-by-component lookup,
    // matching chdir/spawn and the enforcement layers this identity feeds.
    return realpathSync.native(path)
  } catch {
    // realpathSync.native failed: the path (or a prefix) is missing or unreadable.
    return path
  }
}

/**
 * The policy's excluded directories as canonical paths, deduplicated. Unlike an
 * extra grant from {@link workspaceWritableRoots} an exclusion need not exist
 * yet and may be spelled through a symlink: it only ever takes access away, so
 * a spelling that resolves to nothing matches nothing.
 * @param policy - the file-effect policy to read the exclusions from.
 * @returns the canonical excluded roots; empty when the policy excludes nothing.
 */
export function excludedRootsOf(policy: SandboxExecutionPolicy): string[] {
  return [...new Set((policy.excludedRoots ?? []).map(canonicalPath))]
}

/**
 * Remove allow-list roots that lie entirely inside an exclusion. The workspace
 * root survives its own exclusion: a grant grammar that only adds paths cannot
 * express "everything except this subtree", so the leftover hole is the fs
 * fence's to enforce.
 * @param policy - the policy whose workspace root is never removed.
 * @param roots - canonical allow-list roots to filter.
 * @returns the roots that survive the exclusions.
 */
function withoutExcluded(policy: SandboxExecutionPolicy, roots: string[]): string[] {
  const excluded = excludedRootsOf(policy)
  if (excluded.length === 0) return roots
  const workspace = canonicalPath(policy.workspaceRoot)
  return roots.filter((root) => {
    if (root === workspace) return true
    for (const exclusion of excluded) {
      const rel = relative(exclusion, root)
      if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) return false
    }
    return true
  })
}

/**
 * The workspace-owned writable roots — the policy's workspace root plus its
 * explicit extra directories, as a canonical, deduplicated allow-list. Both
 * the workspace and every extra root must be granted together by every
 * backend; this is the one derivation of that set, kept separate from the
 * platform temp policy each backend documents for itself (Seatbelt and the fs
 * fence use {@link writableRoots}; bwrap and Landlock add their own temp
 * grants). Roots inside an excluded directory are removed; none are added.
 * @param policy - the file-effect policy to derive the allow-list from.
 * @returns the canonical workspace-owned roots; empty under `read-only`.
 * @throws {SandboxInvalidRootError} An extra root is missing, is not a directory, or uses a symlink.
 */
export function workspaceWritableRoots(policy: SandboxExecutionPolicy): string[] {
  if (policy.mode !== 'workspace-write') return []
  return withoutExcluded(policy, [...new Set([canonicalPath(policy.workspaceRoot), ...(policy.additionalWritableRoots ?? []).map(additionalRoot)])])
}

/**
 * The roots one confined execution may WRITE under — the mode's meaning as a
 * canonical, deduplicated allow-list. `read-only` allows nothing;
 * `workspace-write` allows the policy's workspace root, its explicit extra
 * directories, the host `/tmp`, and the per-user platform temp dir
 * (`os.tmpdir()` — the real temp area for mkstemp-family tools; omitting it
 * would deny what the mode promises). Roots inside an excluded directory are
 * removed from the temp grants too, so a secure zone placed under a temp area
 * takes that whole grant with it.
 * @param policy - the file-effect policy to derive the allow-list from.
 * @returns the canonical writable roots; empty exactly under `read-only`.
 */
export function writableRoots(policy: SandboxExecutionPolicy): string[] {
  if (policy.mode !== 'workspace-write') return []
  return withoutExcluded(policy, [...new Set([...workspaceWritableRoots(policy), canonicalPath('/tmp'), canonicalPath(tmpdir())])])
}
