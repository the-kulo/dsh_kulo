/**
 * Exhaustiveness backstop for closed union switches.
 * @param value - The `never` residual after all union arms.
 * @returns Never returns; always throws.
 */
export function assertNever(value: never): never {
  throw new Error(`unreachable gateway union: ${JSON.stringify(value)}`)
}
