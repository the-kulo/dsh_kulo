/** Release task specification validation. */

import { ReleaseTaskSpecSchema } from './types.ts'
import type { ReleaseTaskSpec } from './types.ts'

/**
 * Validate a release task specification at the configuration boundary.
 *
 * Production, database, or irreversible operations must set `requiresApproval`
 * to `true` and provide a non-empty `rollbackStrategy`; otherwise the spec is
 * rejected.
 * @param spec - Candidate release task specification.
 * @returns The validated specification.
 * @throws When the spec fails schema validation or irreversible steps lack approval or rollback.
 */
export function validateReleaseTaskSpec(spec: unknown): ReleaseTaskSpec {
  const resolved = ReleaseTaskSpecSchema(spec as ReleaseTaskSpec | null | undefined)
  const hasIrreversible = resolved.steps.some(step => step.irreversible)
  if (hasIrreversible && !resolved.requiresApproval) {
    throw new Error('release tasks with irreversible steps require approval')
  }
  if (hasIrreversible && resolved.rollbackStrategy.length === 0) {
    throw new Error('release tasks with irreversible steps require a rollback strategy')
  }
  return resolved
}
