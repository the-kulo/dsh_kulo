/**
 * WeCom (企业微信) HTTP callback handler: URL verification and encrypted message dispatch.
 *
 * GET  /path?msg_signature=...&timestamp=...&nonce=...&echostr=...  → URL verification
 * POST /path?msg_signature=...&timestamp=...&nonce=...               → message callback
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ServerResponse } from 'node:http'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import { snapshotJsonValue } from '@deepseek-ai/dsh-util-values'
import {
  WebhookDeliveryId,
  WebhookSourceId,
  type VerifiedWebhookDelivery,
} from '@deepseek-ai/dsh-webhook'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { readBoundedUtf8Body, WebhookHttpError } from './body.ts'
import {
  decryptWecomMessage,
  verifyWecomSignature,
  verifyWecomUrl,
  WecomCryptoError,
} from './crypt.ts'
import type { WecomMessage } from './types.ts'

// ---- Handler configuration ----

/** Handler values validated once at plugin load. */
export interface WecomWebhookHandlerConfig {
  /** Adapter instance name carried to rules. */
  readonly source: string
  /** Credential reference for the WeCom Token. */
  readonly tokenEnv: CredentialRef
  /** Credential reference for the WeCom EncodingAESKey. */
  readonly encodingAesKeyEnv: CredentialRef
  /** The CorpId (enterprise WeChat ID) used as receiver id. */
  readonly corpId: string
  /** Positive raw body ceiling in bytes. */
  readonly maxBodyBytes: number
}

// ---- Query string helpers ----

/** Require one unambiguous non-empty query parameter from the URL. */
function requiredQuery(url: URL, name: string): string {
  const value = url.searchParams.get(name)
  if (value === null || value.trim() === '') {
    throw new WebhookHttpError(400, `missing ${name} query parameter`)
  }
  return value
}

// ---- Response helpers ----

/** Send one empty or plain-text response exactly once. */
function respond(response: ServerResponse, status: number, message?: string): void {
  if (message === undefined) {
    response.writeHead(status)
    response.end()
    return
  }
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
  response.end(message)
}

// ---- XML parsing ----

/** XML element name pattern for the top-level <xml> wrapper and direct children. */
const XML_TAG_RE = /<(\w+)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/\1>/g

/**
 * Parse a simple WeCom callback XML body into a flat key-value object.
 * Handles CDATA sections; does not recurse into nested elements.
 *
 * @param xml - raw XML body string.
 * @returns record of element names to text content.
 */
function parseWecomXml(xml: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const match of xml.matchAll(XML_TAG_RE)) {
    const name = match[1]
    const value = match[2] !== undefined ? match[2] : (match[3] ?? '')
    if (name !== undefined && name !== 'xml') {
      result[name] = value
    }
  }
  return result
}

// ---- Message normalization ----

/** Known WeCom MsgType values that map to typed interfaces. */
type KnownMsgType = 'text' | 'image' | 'voice' | 'event'

/** Build shared base fields from parsed XML, omitting AgentID when absent. */
function baseFields(parsed: Record<string, string>) {
  const hasAgent = 'AgentID' in parsed
  return {
    ToUserName: parsed['ToUserName'] ?? '',
    FromUserName: parsed['FromUserName'] ?? '',
    CreateTime: Number(parsed['CreateTime'] ?? 0),
    MsgId: parsed['MsgId'] ?? '',
    ...(hasAgent ? { AgentID: Number(parsed['AgentID']) } as const : {} as const),
  } as const
}

/** Normalize a parsed XML record into a typed WecomMessage. */
function normalizeMessage(parsed: Record<string, string>): WecomMessage {
  const msgType = parsed['MsgType']

  switch (msgType as KnownMsgType | undefined) {
    case 'text': {
      const base = baseFields(parsed)
      return {
        ...base,
        MsgType: 'text' as const,
        Content: parsed['Content'] ?? '',
      }
    }
    case 'image': {
      const base = baseFields(parsed)
      return {
        ...base,
        MsgType: 'image' as const,
        PicUrl: parsed['PicUrl'] ?? '',
        MediaId: parsed['MediaId'] ?? '',
      }
    }
    case 'voice': {
      const base = baseFields(parsed)
      return {
        ...base,
        MsgType: 'voice' as const,
        MediaId: parsed['MediaId'] ?? '',
        Format: parsed['Format'] ?? '',
      }
    }
    case 'event': {
      const hasAgent = 'AgentID' in parsed
      return {
        ToUserName: parsed['ToUserName'] ?? '',
        FromUserName: parsed['FromUserName'] ?? '',
        CreateTime: Number(parsed['CreateTime'] ?? 0),
        MsgType: 'event' as const,
        Event: parsed['Event'] ?? '',
        ...(parsed['EventKey'] !== undefined ? { EventKey: parsed['EventKey'] } as const : {} as const),
        ...(hasAgent ? { AgentID: Number(parsed['AgentID']) } as const : {} as const),
      }
    }
    default: {
      // Unknown message type: treat as text-like with raw content fields.
      const base = baseFields(parsed)
      return {
        ...base,
        MsgType: 'text' as const,
        Content: parsed['Content'] ?? '',
      }
    }
  }
}

// ---- Handler factory ----

/**
 * Create one exact-route WeCom handler that handles both GET (URL verification)
 * and POST (encrypted message callback).
 *
 * @param ctx - adapter context carrying credentials and webhook runtime.
 * @param config - validated source, credential references, and body ceiling.
 * @returns an HTTP handler that answers after in-memory dispatch, never rule settlement.
 */
export function createWecomWebhookHandler(
  ctx: Context,
  config: WecomWebhookHandlerConfig,
): WebRoute['handler'] {
  return async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

      // --- GET: URL verification ---
      if (request.method === 'GET') {
        const signature = requiredQuery(url, 'msg_signature')
        const timestamp = requiredQuery(url, 'timestamp')
        const nonce = requiredQuery(url, 'nonce')
        const echostr = requiredQuery(url, 'echostr')

        const token = (await ctx.credentials.resolve(config.tokenEnv))?.value
        if (token === undefined || token === '') {
          throw new WebhookHttpError(503, 'WeCom token is unavailable')
        }
        const aesKey = (await ctx.credentials.resolve(config.encodingAesKeyEnv))?.value
        if (aesKey === undefined || aesKey === '') {
          throw new WebhookHttpError(503, 'WeCom EncodingAESKey is unavailable')
        }

        try {
          const plaintext = verifyWecomUrl(aesKey, token, config.corpId, signature, timestamp, nonce, echostr)
          respond(response, 200, plaintext)
        } catch (error: unknown) {
          if (error instanceof WecomCryptoError) {
            throw new WebhookHttpError(401, `verification failed: ${error.message}`)
          }
          throw error
        }
        return
      }

      // --- POST: message callback ---
      if (request.method !== 'POST') {
        response.setHeader('allow', 'GET, POST')
        throw new WebhookHttpError(405, 'method not allowed')
      }

      const signature = requiredQuery(url, 'msg_signature')
      const timestamp = requiredQuery(url, 'timestamp')
      const nonce = requiredQuery(url, 'nonce')

      const contentType = request.headers['content-type'] ?? ''
      if (!contentType.includes('text/xml') && !contentType.includes('application/xml')) {
        throw new WebhookHttpError(415, 'content type must be text/xml or application/xml')
      }

      const body = await readBoundedUtf8Body(request, config.maxBodyBytes)
      const parsed = parseWecomXml(body)
      const encrypt = parsed['Encrypt']
      if (encrypt === undefined || encrypt.trim() === '') {
        throw new WebhookHttpError(400, 'missing Encrypt field in XML body')
      }

      const token = (await ctx.credentials.resolve(config.tokenEnv))?.value
      if (token === undefined || token === '') {
        throw new WebhookHttpError(503, 'WeCom token is unavailable')
      }

      // Verify signature before decrypting (defense in depth).
      const sigValid = verifyWecomSignature(token, timestamp, nonce, encrypt, signature)
      if (!sigValid) {
        throw new WebhookHttpError(401, 'invalid WeCom message signature')
      }

      const aesKey = (await ctx.credentials.resolve(config.encodingAesKeyEnv))?.value
      if (aesKey === undefined || aesKey === '') {
        throw new WebhookHttpError(503, 'WeCom EncodingAESKey is unavailable')
      }

      let decrypted: string
      try {
        decrypted = decryptWecomMessage(aesKey, encrypt, config.corpId)
      } catch (error: unknown) {
        if (error instanceof WecomCryptoError) {
          throw new WebhookHttpError(401, `decryption failed: ${error.message}`)
        }
        throw error
      }

      const innerParsed = parseWecomXml(decrypted)
      const message = normalizeMessage(innerParsed)

      // Defensive snapshot: ensure the normalized message is lossless JSON.
      const safe = snapshotJsonValue(message)
      if (safe === undefined) {
        throw new WebhookHttpError(400, 'WeCom message is not lossless JSON')
      }

      const deliveryId = ('MsgId' in message && typeof message.MsgId === 'string' && message.MsgId !== '')
        ? message.MsgId
        : `${timestamp}-${nonce}`
      const delivery: VerifiedWebhookDelivery<'wecom'> = {
        kind: 'wecom',
        source: WebhookSourceId(config.source),
        deliveryId: WebhookDeliveryId(deliveryId),
        event: { message, rawXml: decrypted },
        receivedAt: Date.now(),
      }

      try {
        ctx.webhookRuntime.dispatch(delivery)
      } catch {
        ctx.logger.warn('webhook-wecom: dispatch unavailable')
        throw new WebhookHttpError(503, 'webhook runtime is unavailable')
      }

      // WeCom expects an empty 200 response after receiving the message.
      // If a rule wants to reply, it does so via the outbound webhook URL.
      respond(response, 200)
    } catch (error: unknown) {
      if (error instanceof WebhookHttpError) {
        respond(response, error.status, error.message)
        return
      }
      ctx.logger.warn('webhook-wecom: request failed')
      respond(response, 503, 'webhook ingress is unavailable')
    }
  }
}