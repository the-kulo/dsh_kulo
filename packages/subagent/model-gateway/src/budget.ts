/** Pool-tier daily token budget allocation and validation. */

import { TokenBudgetPolicySchema } from './types.ts'
import type { TokenBudgetAllocation, TokenBudgetPolicy } from './types.ts'

/**
 * Validate and allocate a pool-tier daily token budget into routine, review, and reserved segments.
 * @param policy - Budget policy with fractions that must sum to 1 and fall in their allowed ranges.
 * @returns Token amounts for each segment.
 * @throws When the fractions do not sum to 1 or fall outside their allowed ranges.
 */
export function allocatePoolBudget(policy: TokenBudgetPolicy): TokenBudgetAllocation {
  const resolved = TokenBudgetPolicySchema(policy)
  const sum = resolved.routineFraction + resolved.reviewFraction + resolved.reservedFraction
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`token budget fractions must sum to 1; got ${sum}`)
  }
  const total = resolved.dailyPoolTotal
  return {
    routine: Math.floor(total * resolved.routineFraction),
    review: Math.floor(total * resolved.reviewFraction),
    reserved: Math.floor(total * resolved.reservedFraction),
    total,
  }
}
