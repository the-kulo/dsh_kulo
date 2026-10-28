/** Pure fold from the Client's durable Session event window into Quick answers exchanges. */

import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import type { SessionEventLikeEntry } from '@deepseek-ai/dsh-api-session-controller/client'
import type { UserMessage } from '@deepseek-ai/dsh-llm/types'
import { joinAssistantStreamText } from '@deepseek-ai/dsh-llm/assistant-stream'

/** One rendered exchange in the Quick answers history. */
export interface QuickQaExchangeView {
  /** Stable identity: the durable seq of the user message. */
  readonly key: number
  /** Question text exactly as logged. */
  readonly question: string
  /** Settled answer text. */
  readonly answer: string
  /** Whether the turn remains open. */
  readonly active: boolean
}

function userText(message: UserMessage): string {
  return message.content
    .filter((part): part is Extract<typeof part, { readonly type: 'text' }> => part.type === 'text')
    .map(part => part.text)
    .join('\n')
    .trim()
}

/**
 * Join text from one settled Assistant message.
 * @param event - durable Assistant settlement.
 * @returns the compact stream's visible text.
 */
export function assistantText(event: Extract<SessionEvent, { type: 'assistant/message' }>): string {
  return joinAssistantStreamText(event.data.stream)
}

/**
 * Fold durable entries in log order; transient presentation rows add no history.
 * @param entries - current Client Session event window.
 * @returns question-and-answer rows in durable sequence order.
 */
export function quickQaExchanges(entries: readonly SessionEventLikeEntry[]): readonly QuickQaExchangeView[] {
  const out: QuickQaExchangeView[] = []
  let current: (QuickQaExchangeView & { answerSeq: number }) | null = null
  const pushCurrent = (): void => {
    if (current !== null) out.push(current)
    current = null
  }
  for (const entry of entries) {
    if (entry.type !== 'event') continue
    const event = entry.event
    if (event.type === 'user/message') {
      if (event.data.source.kind !== 'user') continue
      const text = userText(event.data)
      if (text.length === 0) continue
      pushCurrent()
      current = { key: event.seq, question: text, answer: '', active: true, answerSeq: -1 }
      continue
    }
    if (event.type === 'assistant/message' && current !== null) {
      const answer = assistantText(event)
      if (answer.length > 0 || current.answerSeq < 0) {
        current = { ...current, answer, answerSeq: event.seq }
      }
      continue
    }
    if (event.type === 'turn/end' && current !== null) {
      current = { ...current, active: false }
    }
  }
  pushCurrent()
  return out
}
