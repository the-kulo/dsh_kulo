/**
 * Pure parser for `git status --porcelain=v2 --branch -z` output.
 * Extracted so it is unit-testable without a real git installation.
 */

import type { GitFileChange, GitFileState, GitStatus } from './types.ts'
import type { GitRepository } from './types.ts'

/** Parsed branch facts collected from the `# branch.` header lines. */
export interface PorcelainBranch {
  /** Current branch name, or 'HEAD' when detached. */
  branch: string
  /** HEAD object id, or 'initial' for an unborn branch. */
  oid: string
  /** Upstream tracking branch ref; absent when not configured. */
  upstream?: string
  /** Commits ahead of upstream. */
  ahead: number
  /** Commits behind upstream. */
  behind: number
}

/**
 * Parse one `# branch.<key> <value>` line.
 * @returns a partial branch fact; callers merge them.
 */
export function parseBranchLine(line: string): Partial<PorcelainBranch> {
  const prefix = '# branch.'
  // The separator follows the key; the first space in the line is inside the prefix.
  const spaceIdx = line.indexOf(' ', prefix.length)
  if (spaceIdx === -1) return {}
  const key = line.slice(prefix.length, spaceIdx)
  const value = line.slice(spaceIdx + 1)

  switch (key) {
    case 'oid': return { oid: value }
    case 'head': return { branch: value }
    case 'upstream': return { upstream: value }
    case 'ab': {
      const aheadMatch = /\+(\d+)/.exec(value)
      const behindMatch = /-(\d+)/.exec(value)
      return {
        ahead: aheadMatch ? Number(aheadMatch[1]) : 0,
        behind: behindMatch ? Number(behindMatch[1]) : 0,
      }
    }
    default: return {}
  }
}

/**
 * Merge partial branch facts into one complete branch.
 * @param parts - The branch-line parses collected from the output.
 * @returns the merged branch, defaulting to HEAD / initial / 0 ahead/behind.
 */
export function mergeBranchFacts(parts: readonly Partial<PorcelainBranch>[]): PorcelainBranch {
  const merged: PorcelainBranch = { branch: 'HEAD', oid: 'initial', ahead: 0, behind: 0 }
  for (const p of parts) {
    if (p.branch !== undefined && p.branch !== 'HEAD') merged.branch = p.branch
    if (p.oid !== undefined && p.oid !== 'initial') merged.oid = p.oid
    if (p.upstream !== undefined) merged.upstream = p.upstream
    if (p.ahead !== undefined && p.ahead !== 0) merged.ahead = p.ahead
    if (p.behind !== undefined && p.behind !== 0) merged.behind = p.behind
  }
  return merged
}

/**
 * All porcelain v2 output, parsed.
 * For rename entries, `origPath` carries the source path.
 */
export interface ParsedEntry {
  type: 'ordinary' | 'unmerged' | 'untracked' | 'ignored'
  /** The two-character XY status code. */
  xy: string
  /** Repository-relative path. */
  path: string
  /** Original path for renames. */
  origPath?: string
}

/**
 * The complete result of parsing `git status --porcelain=v2 --branch -z`.
 */
export interface PorcelainResult {
  branch: PorcelainBranch
  entries: ParsedEntry[]
}

/**
 * Parse `git status --porcelain=v2 --branch -z` output.
 *
 * The -z format uses NUL as the record terminator. Each entry type is
 * identified by its first character (or two for `# branch.`):
 *
 * - `# branch.oid`, `# branch.head`, `# branch.upstream`, `# branch.ab`
 * - `1 <XY> ... <path>` — ordinary changed entry
 * - `2 <XY> ... <score> <path><NUL><origPath>` — renamed/copied entry
 * - `u <XY> ... <path>` — unmerged entry
 * - `? <path>` — untracked
 * - `! <path>` — ignored
 *
 * @param output - The raw NUL-delimited status output.
 * @returns The parsed branch and entries.
 */
export function parsePorcelainV2(output: string): PorcelainResult {
  const tokens = output.split('\0')
  const branchParts: Partial<PorcelainBranch>[] = []
  const entries: ParsedEntry[] = []

  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]!
    i += 1

    if (token === '') continue

    if (token.startsWith('# branch.')) {
      branchParts.push(parseBranchLine(token))
      continue
    }

    if (token.startsWith('1 ')) {
      const entry = parseOrdinaryEntry(token)
      if (entry) entries.push(entry)
      continue
    }

    if (token.startsWith('2 ')) {
      // Rename entry: "2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path>"
      // Only <origPath> follows as a separate NUL-terminated token.
      const parts = token.split(' ')
      if (parts.length >= 10 && i < tokens.length) {
        const path = parts.slice(9).join(' ')
        const origPath = tokens[i]!
        i += 1
        entries.push({ type: 'ordinary', xy: parts[1]!, path, origPath })
      }
      continue
    }

    if (token.startsWith('u ')) {
      const entry = parseUnmergedEntry(token)
      if (entry) entries.push(entry)
      continue
    }

    if (token.startsWith('? ')) {
      entries.push({ type: 'untracked', xy: '??', path: token.slice(2) })
      continue
    }

    if (token.startsWith('! ')) {
      entries.push({ type: 'ignored', xy: '!!', path: token.slice(2) })
      continue
    }
  }

  return { branch: mergeBranchFacts(branchParts), entries }
}

function parseOrdinaryEntry(token: string): ParsedEntry | undefined {
  // Format: "1 XY sub mH mI mW hH hI path"
  const rest = token.slice(2)
  const parts = rest.split(' ')
  if (parts.length < 8) return undefined
  // First 7 fields are fixed: XY sub mH mI mW hH hI
  // The path starts at character position after the 7th field.
  const xy = parts[0]!
  const sub = parts[1]!
  const mH = parts[2]!
  const mI = parts[3]!
  const mW = parts[4]!
  const hH = parts[5]!
  const hI = parts[6]!
  void sub; void mH; void mI; void mW; void hH; void hI // consumed but unused for mapping

  // Path is everything after the 7 fixed fields.
  const prefixLen = xy.length + 1 + parts[1]!.length + 1 + mH.length + 1 + mI.length + 1 + mW.length + 1 + hH.length + 1 + hI.length + 1
  const path = token.slice(2 + prefixLen)
  return { type: 'ordinary', xy, path }
}

function parseUnmergedEntry(token: string): ParsedEntry | undefined {
  // Format: "u XY sub m1 m2 m3 mW h1 h2 h3 path"
  const rest = token.slice(2)
  const parts = rest.split(' ')
  if (parts.length < 10) return undefined
  const xy = parts[0]!
  const sub = parts[1]!
  void sub

  // Find path: skip 9 fixed fields
  const m1 = parts[2]!; const m2 = parts[3]!; const m3 = parts[4]!
  const mW = parts[5]!; const h1 = parts[6]!; const h2 = parts[7]!; const h3 = parts[8]!
  void m1; void m2; void m3; void mW; void h1; void h2; void h3

  const prefixLen = xy.length + 1 + parts[1]!.length + 1 + m1.length + 1 + m2.length + 1 + m3.length + 1 + mW.length + 1 + h1.length + 1 + h2.length + 1 + h3.length + 1
  const path = token.slice(2 + prefixLen)
  return { type: 'unmerged', xy, path }
}

/**
 * Map an XY status pair to the corresponding {@link GitFileState}.
 * @param xy - The two-character XY code from porcelain v2.
 * @returns the file state.
 */
export function xyToState(xy: string): GitFileState {
  const x = xy[0]!
  const y = xy[1]!

  // Unmerged codes ("AA", "DD", "UU", "AU", "UA", "DU", "UD") have both letters
  // from {A,D,U}; ordinary codes always have '.' or 'M' in at least one slot.
  // Unmerged entries normally reach entryToChange as type 'unmerged' first;
  // this mapping stays correct if they ever do not.
  const isUnmergedLetter = (c: string) => c === 'A' || c === 'D' || c === 'U'
  if (isUnmergedLetter(x) && isUnmergedLetter(y)) return 'conflicted'
  if (y === 'D') return 'deleted'
  if (x === 'A' || x === 'C') return 'added'
  if (x === 'D') return 'deleted'
  if (x === 'R') return 'renamed'
  if (x === 'M' || y === 'M') return 'modified'
  if (x === '?') return 'untracked'
  return 'modified'
}

/**
 * Determine whether an XY pair indicates the change is staged.
 * @param xy - The two-character XY code.
 * @returns true when the index has the change.
 */
export function xyIsStaged(xy: string): boolean {
  const x = xy[0]!
  return x !== '.' && x !== '?' && x !== '!'
}

/**
 * Convert a parsed entry to a {@link GitFileChange}.
 * @param entry - The parsed porcelain entry.
 * @returns the change, or undefined for ignored entries.
 */
export function entryToChange(entry: ParsedEntry): GitFileChange | undefined {
  if (entry.type === 'ignored') return undefined

  if (entry.type === 'untracked') {
    return { path: entry.path, state: 'untracked', staged: false }
  }

  if (entry.type === 'unmerged') {
    return { path: entry.path, state: 'conflicted', staged: false }
  }

  return {
    path: entry.path,
    state: xyToState(entry.xy),
    staged: xyIsStaged(entry.xy),
    ...(entry.origPath !== undefined ? { originalPath: entry.origPath } : {}),
  }
}

/**
 * Build a {@link GitStatus} from parsed porcelain v2 output.
 * @param output - The raw null-delimited git status output.
 * @param repo - The repository facts.
 * @returns the complete status.
 */
export function buildGitStatus(output: string, repo: GitRepository): GitStatus {
  const parsed = parsePorcelainV2(output)
  const changes: GitFileChange[] = []
  for (const entry of parsed.entries) {
    const change = entryToChange(entry)
    if (change) changes.push(change)
  }
  return {
    repository: repo,
    clean: changes.length === 0,
    ahead: parsed.branch.ahead,
    behind: parsed.branch.behind,
    changes,
  }
}
