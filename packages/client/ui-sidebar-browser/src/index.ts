/** Host companion for the Sidebar Browser Client plugin. */
import type { Context, Volatile } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import type { SidebarBrowserPreferences } from './types.ts'

export type { SidebarBrowserPreferences } from './types.ts'

/** Host preferences projected to the browser half through the settings form. */
export interface Config {
  /** Whether the Browser tab may open this deployment's own origin. */
  allowApplicationOrigin: Volatile<SidebarBrowserPreferences['allowApplicationOrigin']>
}

/** Live preferences; the default keeps the application origin refused. */
export const Config = z.object({
  allowApplicationOrigin: z.boolean().default(false).volatile(),
})

/**
 * Serve the preferences form the browser half reads; the browser entry itself mounts through the Client loader.
 * @param ctx - Host plugin context.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
}
