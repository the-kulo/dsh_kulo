/**
 * WeCom (企业微信) HTTP adapter for the provider-neutral webhook runtime.
 *
 * Registers one exact HTTP route that handles:
 *   - GET  with echostr  → URL ownership verification
 *   - POST with encrypted XML → message callback dispatch
 *
 * Each plugin instance connects to one WeCom application or bot; load multiple
 * instances in cordis.yml for multiple WeCom endpoints.
 *
 * @module @deepseek-ai/dsh-webhook-wecom
 */

import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-host-webserver'
import z from '@deepseek-ai/schemastery'
import { createWecomWebhookHandler } from './handler.ts'

export type * from './types.ts'
export { WecomCryptoError } from './crypt.ts'
export { WebhookHttpError } from './body.ts'

/** Cordis function-plugin name. */
export const name = 'webhook-wecom'
/** Host services required before the exact route can register. */
export const inject = ['webServer', 'webhookRuntime', 'credentials']

/** Required WeCom callback configuration. */
export interface Config {
  /** Adapter instance name carried to rules. */
  readonly source: string
  /** Exact absolute route path for the WeCom callback URL. */
  readonly path: string
  /** Credential reference containing the WeCom Token. */
  readonly tokenEnv: string
  /** Credential reference containing the WeCom EncodingAESKey. */
  readonly encodingAesKeyEnv: string
  /** Enterprise WeChat CorpId used as the receiver id for decryption. */
  readonly corpId: string
  /** Positive raw body ceiling in bytes. */
  readonly maxBodyBytes: number
}

export const Config: z<Config> = z.object({
  source: z.string().required(),
  path: z.string().required(),
  tokenEnv: z.string().role('credential-ref').required(),
  encodingAesKeyEnv: z.string().role('credential-ref').required(),
  corpId: z.string().required(),
  maxBodyBytes: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).required(),
})

/** Validate route and source facts that Schemastery cannot express. */
function assertConfig(config: Config): void {
  if (config.source.trim() !== config.source || config.source === '') {
    throw new Error('webhook-wecom source must be a non-empty trimmed string')
  }
  if (
    !config.path.startsWith('/') || config.path === '/' || config.path.endsWith('/')
    || config.path.includes('?') || config.path.includes('#')
  ) {
    throw new Error(
      'webhook-wecom path must be an absolute non-root pathname without a trailing slash, query, or fragment',
    )
  }
  if (config.corpId.trim() !== config.corpId || config.corpId === '') {
    throw new Error('webhook-wecom corpId must be a non-empty trimmed string')
  }
}

/** Register one WeCom callback endpoint on the injected WebServer. */
export function apply(ctx: Context, config: Config): void {
  assertConfig(config)
  const route = {
    kind: 'exact' as const,
    path: config.path,
    handler: createWecomWebhookHandler(ctx, {
      source: config.source,
      tokenEnv: credentialRef(config.tokenEnv),
      encodingAesKeyEnv: credentialRef(config.encodingAesKeyEnv),
      corpId: config.corpId,
      maxBodyBytes: config.maxBodyBytes,
    }),
  }
  ctx.effect(
    () => ctx.webServer.register(route),
    `webhook-wecom: ${config.path}`,
  )
}