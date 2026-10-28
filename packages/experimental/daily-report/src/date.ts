const DATE = /^\d{4}-\d{2}-\d{2}$/

function parts(date: Date, timeZone: string) {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const numbers = Object.fromEntries(values.filter(part => part.type !== 'literal')
    .map(part => [part.type, Number(part.value)])) as Record<string, number | undefined>
  const required = (name: string): number => {
    const value = numbers[name]
    if (value === undefined) throw new Error(`Invalid date parts in ${timeZone}`)
    return value
  }
  return {
    year: required('year'), month: required('month'), day: required('day'),
    hour: required('hour'), minute: required('minute'), second: required('second'),
  }
}

/**
 * Convert a local calendar time to an instant, rejecting nonexistent local times.
 * @param date - Local calendar date in YYYY-MM-DD format.
 * @param time - Local time in HH:mm format.
 * @param timeZone - IANA time zone used to interpret the local time.
 * @returns Unix epoch milliseconds for the local time.
 * @throws {Error} If the date or time is malformed, the local time does not exist, or the time zone is invalid.
 */
export function zonedInstant(date: string, time: string, timeZone: string): number {
  if (!DATE.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error(`Invalid daily-report date or time: ${date} ${time}`)
  const desired = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)),
    Number(time.slice(0, 2)), Number(time.slice(3, 5)))
  let guess = desired
  for (let attempt = 0; attempt < 3; attempt++) {
    const actual = parts(new Date(guess), timeZone)
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second)
    const adjustment = desired - represented
    if (adjustment === 0) return guess
    guess += adjustment
  }
  const actual = parts(new Date(guess), timeZone)
  if (Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute) !== desired) {
    throw new Error(`Local time does not exist in ${timeZone}: ${date} ${time}`)
  }
  return guess
}

/**
 * Format an instant as a local ISO calendar date.
 * @param now - Unix epoch milliseconds.
 * @param timeZone - IANA time zone for the calendar date.
 * @returns Local calendar date in YYYY-MM-DD format.
 * @throws {Error} If the instant or time zone is invalid.
 */
export function zonedDate(now: number, timeZone: string): string {
  const value = parts(new Date(now), timeZone)
  return `${value.year.toString().padStart(4, '0')}-${value.month.toString().padStart(2, '0')}-${value.day.toString().padStart(2, '0')}`
}

/**
 * Resolve the half-open active window for one local workday.
 * @param date - Local workday in YYYY-MM-DD format.
 * @param timeZone - IANA time zone for both endpoints.
 * @param start - Inclusive local HH:mm start.
 * @param end - Exclusive local HH:mm end.
 * @returns Inclusive start and exclusive end as Unix epoch milliseconds.
 * @throws {Error} If an endpoint is invalid or the window does not end after it starts.
 */
export function activeWindow(date: string, timeZone: string, start: string, end: string): { start: number; end: number } {
  const range = { start: zonedInstant(date, start, timeZone), end: zonedInstant(date, end, timeZone) }
  if (range.start >= range.end) throw new Error('daily-report active window must end after it starts')
  return range
}
