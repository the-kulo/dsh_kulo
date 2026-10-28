import { z } from 'zod'
import { SessionId } from '@deepseek-ai/dsh-session'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'

const reportSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generatedAt: z.iso.datetime({ precision: 3 }),
  trigger: z.enum(['manual', 'schedule']),
  status: z.enum(['completed', 'empty', 'failed']),
  completed: z.array(z.string()),
  inProgress: z.array(z.string()),
  blocked: z.array(z.string()),
  followUp: z.array(z.string()),
  sources: z.array(z.object({
    sessionId: z.string().min(1).transform(SessionId),
    title: z.string().min(1),
  }).strict()),
  error: z.string().optional(),
}).strict()

/** Durable generation history; one row per attempt preserves failures and prior successes. */
export const dailyReportDomain = defineDomain({
  name: 'daily_report', version: 1,
  tables: { reports: domainTable<string, z.infer<typeof reportSchema>>(reportSchema) },
})
