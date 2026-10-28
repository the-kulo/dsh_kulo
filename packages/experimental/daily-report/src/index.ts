/** Scheduled, evidence-linked daily work reports over session-query and AgentLoop. */

import { randomUUID } from 'node:crypto'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { z as zod } from 'zod'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@deepseek-ai/dsh-session-title'
import type {} from '@deepseek-ai/dsh-schedule'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import { activeWindow, zonedDate } from './date.ts'
import { collectActivity } from './sources.ts'
import type { ActivitySource } from './sources.ts'
import { dailyReportDomain } from './storage.ts'
import type { DailyReport, DailyReportGenerateRequest } from './types.ts'

export type * from './types.ts'

const REPORT_SESSION_ID = brandString<SessionId>('daily-report')
const SCHEDULE_PROMPT = 'Generate the scheduled daily work report.'
const outputSchema = zod.object({
  completed: zod.array(zod.string().trim().min(1)),
  inProgress: zod.array(zod.string().trim().min(1)),
  blocked: zod.array(zod.string().trim().min(1)),
  followUp: zod.array(zod.string().trim().min(1)),
}).strict()

/** Daily-report deployment configuration. */
export interface Config {
  /** Model provider identifier for the dedicated report Agent. */
  readonly provider: string
  /** Model identifier for the dedicated report Agent. */
  readonly model: string
  /** IANA time zone for report dates, activity windows, and scheduling; defaults to Asia/Shanghai. */
  readonly timeZone?: string
  /** Inclusive local HH:mm start of the activity window; defaults to 08:30. */
  readonly activeStart?: string
  /** Exclusive local HH:mm end of the activity window and daily generation time; defaults to 18:00. */
  readonly scheduleTime?: string
  /** Maximum UTF-8 bytes retained per source Session transcript; defaults to 24,576 and must be at least 1,024. */
  readonly maxSessionBytes?: number
}

export const Config: z<Config> = z.object({
  provider: z.string().min(1).required(),
  model: z.string().min(1).required(),
  timeZone: z.string().min(1).default('Asia/Shanghai'),
  activeStart: z.string().pattern(/^\d{2}:\d{2}$/).default('08:30'),
  scheduleTime: z.string().pattern(/^\d{2}:\d{2}$/).default('18:00'),
  maxSessionBytes: z.number().step(1).min(1024).default(24_576),
})

declare module '@deepseek-ai/cordis' {
  interface Context {
    dailyReports: DailyReportService
  }
}

interface GenerationRequest {
  readonly date: string
  readonly trigger: 'manual' | 'schedule'
  readonly resolve?: (report: DailyReport) => void
  readonly reject?: (error: Error) => void
}

interface ActiveGeneration {
  readonly request: GenerationRequest
  readonly sources: ActivitySource[]
  readonly output: string[]
  settled: boolean
}

function errorOf(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function reportPrompt(date: string, timeZone: string, sources: ActivitySource[]): string {
  const evidence = sources.map(source => `## Session ${source.sessionId}: ${source.title}\n${source.transcript}`).join('\n\n')
  return `Summarize the supplied work activity for ${date} (${timeZone}). Return only strict JSON with exactly four arrays of strings: completed, inProgress, blocked, followUp. Use only facts explicitly supported by the activity. Do not invent repositories, files, outcomes, blockers, or plans. Keep an array empty when no evidence supports it. Source links are retained separately and must not be invented.\n\n${evidence}`
}

/** Host service owning report generation, durable history, and the 18:00 Schedule binding. */
export class DailyReportService extends TypertRemoteService {
  static inject = ['agents', 'sessions', 'sessionQuery', 'schedule', 'storageDomain', 'sessionPersistence']
  static Config = Config

  private readonly config: Required<Config>
  private readonly domain: Promise<Domain<typeof dailyReportDomain>>
  private readonly requests = new Map<string, GenerationRequest>()
  private readonly inFlight = new Set<Promise<unknown>>()
  private active: ActiveGeneration | undefined
  private agent: Agent | undefined
  private stopping = false
  private chain: Promise<unknown> = Promise.resolve()

  constructor(ctx: Context, config: Config) {
    super(ctx, 'dailyReports')
    this.config = {
      provider: config.provider, model: config.model,
      timeZone: config.timeZone ?? 'Asia/Shanghai', activeStart: config.activeStart ?? '08:30',
      scheduleTime: config.scheduleTime ?? '18:00', maxSessionBytes: config.maxSessionBytes ?? 24_576,
    }
    zonedInstantCheck(this.config)
    this.domain = ctx.storageDomain.open(dailyReportDomain)
  }

  protected async [Service.init](): Promise<void> {
    const ctx = this.ctx
    ctx.on('agent/pre-step', async ({ agent, messages }, next): Promise<PreStepDecision> => {
      if (agent.id !== REPORT_SESSION_ID) return next()
      const submitted = messages.find((message): message is UserMessage => 'content' in message && (this.requests.has(message.id)
        || this.text(message) === SCHEDULE_PROMPT))
      if (submitted === undefined) return next()
      const request = this.requests.get(submitted.id) ?? {
        date: zonedDate(Date.now(), this.config.timeZone), trigger: 'schedule' as const,
      }
      this.requests.delete(submitted.id)
      let sources: ActivitySource[] = []
      let failure: Error | undefined
      try {
        sources = await collectActivity(ctx.sessionQuery, REPORT_SESSION_ID,
          activeWindow(request.date, this.config.timeZone, this.config.activeStart, this.config.scheduleTime),
          this.config.maxSessionBytes)
      } catch (error: unknown) {
        failure = errorOf(error)
      }
      const active: ActiveGeneration = { request, sources, output: [], settled: false }
      this.active = active
      if (failure !== undefined) await this.fail(active, failure)
      else if (sources.length === 0) await this.persist(active, 'empty')
      const decision = await next()
      if (failure !== undefined || sources.length === 0 || decision.kind === 'reject') {
        if (decision.kind === 'reject' && failure === undefined && sources.length > 0) {
          await this.fail(active, new Error('Daily-report model step was rejected'))
        }
        return { kind: 'reject' }
      }
      const prompt = reportPrompt(request.date, this.config.timeZone, sources)
      return { ...decision, messages: decision.messages.map(message => message.id === submitted.id
        ? { ...message, content: [{ type: 'text' as const, text: prompt }] }
        : message) }
    })
    ctx.on('session/event', (session, event) => {
      if (session.id !== REPORT_SESSION_ID || this.active === undefined) return
      if (event.type === 'assistant/message') {
        this.active.output.push(...event.data.message.content.flatMap(block => block.type === 'text' ? [block.text] : []))
      }
      if (event.type === 'turn/end') {
        const active = this.active
        this.active = undefined
        this.track(this.finish(active, event.data.reason.kind))
      }
    })
    ctx.effect(() => async () => {
      this.stopping = true
      for (const request of this.requests.values()) request.reject?.(new Error('Daily-report service stopped'))
      this.requests.clear()
      await this.chain
      await Promise.allSettled([...this.inFlight])
      await (await this.domain).close()
    }, 'dailyReports lifecycle')
    const agentOptions = { provider: this.config.provider, model: this.config.model }
    const live = ctx.agents.get(REPORT_SESSION_ID)
    if (live !== undefined) this.agent = live
    else {
      const persisted = await ctx.sessionPersistence.stat(REPORT_SESSION_ID)
      this.agent = await (persisted === undefined
        ? ctx.agents.create({ sessionId: REPORT_SESSION_ID, agentOptions })
        : ctx.agents.resume({ resumeSessionId: REPORT_SESSION_ID, agentOptions })).then(handle => handle.agent)
    }
    const catalog = await ctx.schedule.catalog()
    if (!catalog.some(task => task.sessionId === REPORT_SESSION_ID && task.prompt === SCHEDULE_PROMPT && task.status === 'active')) {
      await ctx.schedule.create(REPORT_SESSION_ID, {
        title: 'Daily work report', prompt: SCHEDULE_PROMPT,
        daily: { time: `${this.config.scheduleTime}:00`, time_zone: this.config.timeZone },
      })
    }
  }

  /**
   * Read durable generation attempts without activating source Sessions.
   * @returns Generation attempts sorted newest first by generation time and identifier.
   */
  @Remote('list')
  async list(): Promise<DailyReport[]> {
    const domain = await this.domain
    return [...domain.table('reports').entries()].map(([, report]) => report)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt) || b.id.localeCompare(a.id))
  }

  /**
   * Queue one manual report and resolve only after its durable attempt commits.
   * @param request - Manual generation input with an optional local report date.
   * @returns The persisted generation attempt, including empty and failed reports.
   * @throws {Error} If the service is unavailable, the requested date is invalid, or the attempt cannot be persisted.
   */
  @Remote('generate')
  generate(request: DailyReportGenerateRequest): Promise<DailyReport> {
    const pending = this.chain.then(() => this.runManual(request))
    this.chain = pending.catch(() => undefined)
    return pending
  }

  private async runManual(request: DailyReportGenerateRequest): Promise<DailyReport> {
    const agent = this.agent
    if (this.stopping || agent === undefined) throw new Error('Daily-report service is unavailable')
    const date = request.date ?? zonedDate(Date.now(), this.config.timeZone)
    activeWindow(date, this.config.timeZone, this.config.activeStart, this.config.scheduleTime)
    const message = createUserMessage({ content: [{ type: 'text', text: SCHEDULE_PROMPT }], source: { kind: 'user' } })
    return new Promise<DailyReport>((resolve, reject) => {
      this.requests.set(message.id, { date, trigger: 'manual', resolve, reject })
      agent.followup(message)
    })
  }

  private text(message: UserMessage): string {
    return message.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('')
  }

  private async finish(active: ActiveGeneration, reason: string): Promise<void> {
    if (active.settled) return
    if (reason !== 'completed') return this.fail(active, new Error(`Daily-report generation ended with ${reason}`))
    const text = active.output.join('').trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
    try {
      const output = outputSchema.parse(JSON.parse(text))
      await this.persist(active, 'completed', output)
    } catch (error: unknown) {
      await this.fail(active, new Error(`Daily-report model output was invalid: ${errorOf(error).message}`))
    }
  }

  private async fail(active: ActiveGeneration, error: Error): Promise<void> {
    await this.persist(active, 'failed', undefined, error.message)
  }

  private async persist(
    active: ActiveGeneration,
    status: DailyReport['status'],
    output?: zod.infer<typeof outputSchema>,
    error?: string,
  ): Promise<void> {
    if (active.settled) return
    const report: DailyReport = {
      id: `${active.request.date}-${randomUUID()}`, date: active.request.date,
      generatedAt: new Date().toISOString(), trigger: active.request.trigger, status,
      completed: output?.completed ?? [], inProgress: output?.inProgress ?? [],
      blocked: output?.blocked ?? [], followUp: output?.followUp ?? [],
      sources: active.sources.map(({ sessionId, title }) => ({ sessionId, title })),
      ...error === undefined ? {} : { error },
    }
    try {
      await (await this.domain).table('reports').put(report.id, {
        ...report, completed: [...report.completed], inProgress: [...report.inProgress],
        blocked: [...report.blocked], followUp: [...report.followUp], sources: [...report.sources],
      })
      active.settled = true
      active.request.resolve?.(report)
    } catch (caught: unknown) {
      const failure = errorOf(caught)
      active.request.reject?.(failure)
      throw failure
    }
  }

  private track(operation: Promise<void>): void {
    this.inFlight.add(operation)
    void operation.catch((error: unknown) => {
      this.ctx.logger.warn(`daily-report: ${errorOf(error).message}`)
    }).finally(() => this.inFlight.delete(operation))
  }
}

function zonedInstantCheck(config: Required<Config>): void {
  activeWindow('2000-01-03', config.timeZone, config.activeStart, config.scheduleTime)
}

export default DailyReportService
