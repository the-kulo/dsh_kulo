import { resolve } from 'node:path'
import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import { FsError } from '@deepseek-ai/dsh-fs'
import type { FsTarget } from '@deepseek-ai/dsh-fs'
import { expandHomePath } from '@deepseek-ai/dsh-home-paths'
import type { Session } from '@deepseek-ai/dsh-session'
// Type-only: the `ctx.sessionProjections` merge plus the `zone` projection key.
import type {} from '@deepseek-ai/dsh-session-projection'
import z from '@deepseek-ai/schemastery'

export { FsError } from '@deepseek-ai/dsh-fs'

declare module '@deepseek-ai/cordis' {
  interface Context {
    fsZones: FsZonesService
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Dedicated sidebar zone the Session belongs to; null for ordinary Sessions. */
    zone: 'quick-qa' | 'secure' | null
  }
}

export interface Config {
  /** Directory holding the secure zone. */
  secureDir?: string
  /** Additional directories a secure-zone Session may access beside its zone directory. */
  additionalSecureDirs?: string[]
}

/** The Session and AbortSignal carried by one tool execution. */
export interface ZoneCarrier {
  readonly agent?: { readonly session: Session }
  readonly signal?: AbortSignal
}

/** Builds fs.resolve options, omitting undefined fields for exactOptionalPropertyTypes. */
function resolveOptions(
  cwd: string | undefined,
  signal: AbortSignal | undefined,
): { cwd?: string; signal?: AbortSignal } {
  const options: { cwd?: string; signal?: AbortSignal } = {}
  if (cwd !== undefined) options.cwd = cwd
  if (signal !== undefined) options.signal = signal
  return options
}

/**
 * Enforces the two-way directory isolation between the secure zone and the
 * workspace.
 *
 * A Session pinned to the secure zone may only touch the zone directory, and an
 * ordinary Session may not touch it at all. The rules apply to every sandbox
 * mode, so ordinary Sessions keep full access to the rest of the workspace.
 */
export default class FsZonesService extends Service {
  static Config: z<Config> = z.object({
    secureDir: z.string().default('~/.dsh/zones/secure'),
    additionalSecureDirs: z.array(z.string()).default([]),
  })

  /** Absolute path of the secure zone directory. */
  readonly secureRoot: string

  /** Absolute paths a secure-zone Session may touch: the zone directory and its additions. */
  private readonly roots: string[]

  /** Absolute paths a secure-zone Session may touch: the zone directory and its additions. */
  secureRoots: readonly string[]

  constructor(ctx: Context, config: Config) {
    super(ctx, 'fsZones')
    this.secureRoot = resolve(expandHomePath(config.secureDir ?? '~/.dsh/zones/secure'))
    this.roots = [
      this.secureRoot,
      ...(config.additionalSecureDirs ?? []).map((dir) => resolve(expandHomePath(dir))),
    ]
    this.secureRoots = [...this.roots]
  }

  /**
   * Add a directory a secure-zone Session may additionally touch. Idempotent:
   * re-adding an existing root keeps one entry.
   * @param dir - absolute or tilde-prefixed directory to allow beside the zone directory.
   */
  addSecureDir(dir: string): void {
    const resolved = resolve(expandHomePath(dir))
    if (!this.roots.includes(resolved)) this.roots.push(resolved)
    this.secureRoots = [...this.roots]
  }

  /**
   * Whether this execution belongs to a Session pinned to the secure zone.
   * @param exec Session carrier of the tool execution.
   * @returns `true` for secure-zone Sessions.
   */
  isSecureSession(exec: ZoneCarrier): boolean {
    if (exec.agent === undefined) return false
    const projections = this.ctx.get('sessionProjections')
    if (projections === undefined) return false
    return projections.snapshot(exec.agent.session, ['zone']).values.zone === 'secure'
  }

  /**
   * Whether `target` lies inside any secure-zone root (the zone directory or
   * one of its additions).
   */
  private async containsSecureRoot(exec: ZoneCarrier, target: FsTarget): Promise<boolean> {
    const fs = this.ctx.get('fs')
    if (fs === undefined) return false
    const options = resolveOptions(undefined, exec.signal)
    for (const rootPath of this.secureRoots) {
      const root = await fs.resolve(rootPath, options)
      if (fs.contains(root, target)) return true
    }
    return false
  }

  /**
   * Reject cross-zone access for one resolved target: secure-zone Sessions may
   * only touch their own zone (and its additions) and ordinary Sessions may
   * not touch the zone at all.
   * @param exec Session carrier of the tool execution.
   * @param target Resolved filesystem target about to be accessed.
   */
  async assertTarget(exec: ZoneCarrier, target: FsTarget): Promise<void> {
    const fs = this.ctx.get('fs')
    if (fs === undefined) return
    const inside = await this.containsSecureRoot(exec, target)
    if (inside === this.isSecureSession(exec)) return
    throw new FsError(
      `cannot access "${target.displayPath}": ${inside ? 'secure-zone sessions are isolated from the workspace' : 'the secure zone is isolated from the workspace'}`,
      'FS_ZONE_DENIED',
    )
  }

  /**
   * Like {@link assertTarget}, resolving a raw path (relative against `cwd`) first.
   * @param exec Session carrier of the tool execution.
   * @param path Path about to be accessed.
   * @param cwd Directory relative paths resolve against.
   */
  async assertPath(exec: ZoneCarrier, path: string, cwd?: string): Promise<void> {
    const fs = this.ctx.get('fs')
    if (fs === undefined) return
    const target = await fs.resolve(path, resolveOptions(cwd, exec.signal))
    const inside = await this.containsSecureRoot(exec, target)
    if (inside === this.isSecureSession(exec)) return
    throw new FsError(
      `cannot access "${path}": ${inside ? 'secure-zone sessions are isolated from the workspace' : 'the secure zone is isolated from the workspace'}`,
      'FS_ZONE_DENIED',
    )
  }
}
