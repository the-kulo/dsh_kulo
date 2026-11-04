/**
 * WeCom (企业微信) outbound reply sender.
 *
 * After the webhook runtime has dispatched a message and a rule has executed a DSH
 * Worker Session, the result is sent back to the WeCom group or user via the bot's
 * webhook URL. This module provides a simple HTTP POST helper for that purpose.
 *
 * WeCom bot webhook URL format: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...
 *
 * @module @deepseek-ai/dsh-webhook-wecom
 */

import type { WecomReply } from './types.ts'

/** Default timeout for outbound WeCom webhook requests (ms). */
const DEFAULT_REPLY_TIMEOUT_MS = 10_000

/**
 * Maximum UTF-8 bytes of a single reply payload. WeCom limits text messages to
 * 2048 characters; markdown to 4096. We use a safe 3800-byte ceiling.
 */
const MAX_REPLY_BYTES = 3_800

/**
 * WeCom outbound reply error carrying only non-sensitive detail.
 */
export class WecomReplyError extends Error {
  override readonly name = 'WecomReplyError'

  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/**
 * Send one reply message to a WeCom bot webhook URL.
 *
 * @param webhookUrl - the full WeCom bot webhook URL (https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...).
 * @param reply - the typed reply to send.
 * @param timeoutMs - HTTP request timeout in milliseconds.
 * @throws {WecomReplyError} on HTTP failure or non-200 response.
 */
export async function sendWecomReply(
  webhookUrl: string,
  reply: WecomReply,
  timeoutMs: number = DEFAULT_REPLY_TIMEOUT_MS,
): Promise<void> {
  const body = JSON.stringify(reply)
  if (Buffer.byteLength(body, 'utf-8') > MAX_REPLY_BYTES) {
    throw new WecomReplyError(0, 'reply payload exceeds WeCom size limit')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body,
      signal: controller.signal,
    })
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      throw new WecomReplyError(0, 'WeCom webhook request timed out')
    }
    throw new WecomReplyError(0, `WeCom webhook request failed: ${String(error)}`)
  } finally {
    clearTimeout(timer)
  }

  // Consume body to release the connection.
  let responseBody: string
  try {
    responseBody = await response.text()
  } catch {
    responseBody = '<unreadable>'
  }

  if (!response.ok) {
    throw new WecomReplyError(response.status, `WeCom webhook returned ${response.status}: ${responseBody}`)
  }

  // WeCom returns { errcode: 0, errmsg: "ok" } on success.
  let result: unknown
  try {
    result = JSON.parse(responseBody)
  } catch {
    throw new WecomReplyError(response.status, `WeCom webhook response is not valid JSON: ${responseBody}`)
  }

  if (result !== null && typeof result === 'object') {
    const obj = result as Record<string, unknown>
    if (obj['errcode'] !== 0) {
      throw new WecomReplyError(
        response.status,
        `WeCom webhook error: errcode=${String(obj['errcode'])} errmsg=${String(obj['errmsg'])}`,
      )
    }
  }
}