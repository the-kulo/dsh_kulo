/**
 * OpenTelemetry Service Provider for the DeepSeek Harness telemetry capability.
 *
 * Session feedback upload was removed together with the feedback producers, so
 * the only remaining sharing policy is `DISABLED`: the plugin registers the
 * `sessionTelemetry` service without constructing SDK state.
 *
 * @module @deepseek-ai/dsh-session-telemetry-otel
 */

import z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import type {
  SessionTelemetryRecord,
  SessionTelemetrySharingStatus,
} from '@deepseek-ai/dsh-session-telemetry'
import { SessionTelemetryBackend } from '@deepseek-ai/dsh-session-telemetry'

/** Session-sharing policy selected by {@link Config.mode}. */
export enum SessionTelemetryMode {
  DISABLED = 'DISABLED',
}

/** Default session-sharing policy for schema and direct construction. */
export const DEFAULT_TELEMETRY_MODE = SessionTelemetryMode.DISABLED

/**
 * Plugin configuration. `DISABLED` is the only sharing policy; the SDK
 * transport fields are retained so existing deployment configs still validate,
 * and none of them is read.
 */
export interface Config {
  /** Only `DISABLED` remains: session telemetry stays local. */
  mode?: SessionTelemetryMode
  /** Retained for configuration compatibility; never read. */
  exporter?: { url?: string }
  /** Retained for configuration compatibility; never read. */
  processor?: unknown
  /** Retained for configuration compatibility; never read. */
  shutdownTimeoutMillis?: number
  /** Retained for configuration compatibility; never read. */
  maxRequestBytes?: number
}

/**
 * Schemastery validator for {@link Config}; cordis runs it before the plugin
 * starts.
 */
export const Config: z<Config> = z.object({
  mode: z.union(Object.values(SessionTelemetryMode)).default(DEFAULT_TELEMETRY_MODE),
  exporter: z.any(),
  processor: z.any(),
  shutdownTimeoutMillis: z.number(),
  maxRequestBytes: z.number().step(1).min(1).max(4_000_000),
})

/**
 * The backend plugin — the only entry a deployment loads. It always registers
 * the `sessionTelemetry` service (duplicate load throws). With feedback
 * removed, `DISABLED` is the sole mode: no SDK state is constructed and no
 * Session content leaves the process.
 */
export class OpenTelemetrySessionBackend extends SessionTelemetryBackend {
  static Config = Config

  override readonly sharing: SessionTelemetrySharingStatus = 'disabled'

  constructor(ctx: Context) {
    super(ctx)
  }

  /**
   * Drop direct records. No submission can authorize capture now that the
   * feedback producers are gone.
   * @param _record - the direct record, never uploaded.
   */
  emit(_record: SessionTelemetryRecord): void {}

  /**
   * Complete immediately: `DISABLED` constructs no SDK provider, so there is
   * nothing to drain.
   * @returns completion, always resolved.
   */
  async shutdown(): Promise<void> {}
}

export default OpenTelemetrySessionBackend
