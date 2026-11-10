/**
 * Client git panel plugin: installs the `gitPanel` service key and wires
 * it to the generated `ctx.remote.git` namespace.
 */

import type { Context } from '@deepseek-ai/cordis'
import { GitPanel } from './service.ts'
import type { IGitPanel } from './service.ts'

export type { GitPanelView, IGitPanel } from './service.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** React-free git panel state and commands. */
    gitPanel: IGitPanel
  }
}

/** Required Client Remote services. */
export const inject = ['remote', 'remote.git']

/**
 * Install the client git panel service.
 * @param ctx - Client root Context.
 */
export function apply(ctx: Context): void {
  ctx.plugin(GitPanel)
}
