/**
 * The session-log record of the dedicated sidebar zone a Session was created
 * into, and the `zone` Session projection that reconstructs it.
 *
 * The zone is orthogonal to the agent preset: a zone Session runs the default
 * `standard` preset (or any other switchable mode) while its data boundary is
 * enforced at the zone layer, so it is recorded as its own log event instead of
 * a creation-header field. The record is whole-value and required: a reader
 * that does not recognize `session/zone` refuses the log rather than silently
 * dropping a fact the secure boundary depends on.
 *
 * @module @deepseek-ai/dsh-api-session-controller/zone
 */

import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import { z } from 'zod'
import type { SessionZone } from './types.ts'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * The Session was created into a dedicated sidebar zone. Appended exactly
     * once, immediately after the Session is created; log-only, so a resumed
     * or forked Session reconstructs the same zone and its data boundary.
     */
    'session/zone': { zone: SessionZone }
  }
}

/** Validated persisted state for the `zone` projection. */
const sessionZoneSchema = z.union([z.literal('quick-qa'), z.literal('secure'), z.null()])

/** Current Session zone, initialized empty and advanced by `session/zone` records. */
export const zoneProjectionDefinition = {
  key: 'zone',
  stateSchema: sessionZoneSchema,
  init: () => null,
  apply: (state, event) => event.type === 'session/zone' ? event.data.zone : state,
  wire: { viewSchema: sessionZoneSchema, view: state => state },
  stateVersion: 1,
} satisfies ProjectionDefinition<'zone', SessionZone | null>
