import { describe, expect, it } from 'vitest'
import { activeWindow, zonedDate, zonedInstant } from '../src/date.ts'

describe('daily-report local work windows', () => {
  it('uses Asia/Shanghai rather than the Host time zone', () => {
    expect(activeWindow('2026-09-16', 'Asia/Shanghai', '08:30', '18:00')).toEqual({
      start: Date.parse('2026-09-16T00:30:00.000Z'), end: Date.parse('2026-09-16T10:00:00.000Z'),
    })
    expect(zonedDate(Date.parse('2026-09-16T16:30:00.000Z'), 'Asia/Shanghai')).toBe('2026-09-17')
  })

  it('rejects nonexistent daylight-saving local times', () => {
    expect(() => zonedInstant('2026-03-08', '02:30', 'America/New_York')).toThrow(/does not exist/)
    expect(zonedDate(Date.parse('2026-03-08T07:30:00.000Z'), 'America/New_York')).toBe('2026-03-08')
  })

  it('rejects an inverted work window', () => {
    expect(() => activeWindow('2026-09-16', 'Asia/Shanghai', '18:00', '08:30')).toThrow(/end after/)
  })
})
