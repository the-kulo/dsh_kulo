import type { SessionQueryEngine } from '@deepseek-ai/dsh-session-query'
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { DailyReportSource } from './types.ts'

/** A source Session and its bounded activity transcript used as report evidence. */
export interface ActivitySource extends DailyReportSource {
  /** Timestamped user and assistant text from the active window, within the configured UTF-8 byte limit. */
  readonly transcript: string
}

function textOf(event: SessionEvent): string | undefined {
  if (event.type === 'user/message') {
    return event.data.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n').trim() || undefined
  }
  if (event.type === 'assistant/message') {
    return event.data.message.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n').trim() || undefined
  }
  return undefined
}

function takeUtf8Prefix(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value, 'utf8') <= maxBytes) return value
  const chars = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value), part => part.segment)
  let low = 0
  let high = chars.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    const prefix = chars.slice(0, middle).join('')
    if (Buffer.byteLength(prefix, 'utf8') <= maxBytes) low = middle
    else high = middle - 1
  }
  return chars.slice(0, low).join('')
}

/**
 * Read current logical Sessions through session-query and retain user and assistant text inside the work window.
 * @param query - Session query engine used to list and read Sessions.
 * @param excluded - Session identifier omitted from collection.
 * @param window - Half-open activity window as Unix epoch milliseconds.
 * @param maxSessionBytes - Maximum UTF-8 bytes retained in each transcript.
 * @returns Sources with in-window activity, in session-query listing order.
 * @throws {Error} If session-query cannot list or read a Session.
 */
export async function collectActivity(
  query: SessionQueryEngine,
  excluded: SessionId,
  window: { start: number; end: number },
  maxSessionBytes: number,
): Promise<ActivitySource[]> {
  const records = await query.listSessions()
  const result: ActivitySource[] = []
  for (const record of records) {
    if (record.header.id === excluded) continue
    const log = await query.readSession(record.header.id)
    const lines: string[] = []
    let title: string = record.header.id
    for (const event of log.events) {
      if (event.type === 'session/title') title = event.data.title
      if (event.time < window.start || event.time >= window.end) continue
      const text = textOf(event)
      if (text === undefined) continue
      const role = event.type === 'user/message' ? 'User' : 'Assistant'
      lines.push(`${role} at ${new Date(event.time).toISOString()}:\n${text}`)
    }
    if (lines.length === 0) continue
    let transcript = lines.join('\n\n')
    if (Buffer.byteLength(transcript, 'utf8') > maxSessionBytes && lines.length > 1) {
      let low = 1
      let high = lines.length - 1
      while (low < high) {
        const middle = Math.floor((low + high) / 2)
        const candidate = `[Earlier activity omitted]\n\n${lines.slice(middle).join('\n\n')}`
        if (Buffer.byteLength(candidate, 'utf8') <= maxSessionBytes) high = middle
        else low = middle + 1
      }
      transcript = `[Earlier activity omitted]\n\n${lines.slice(low).join('\n\n')}`
    }
    transcript = takeUtf8Prefix(transcript, maxSessionBytes)
    result.push({ sessionId: record.header.id, title, transcript })
  }
  return result
}
