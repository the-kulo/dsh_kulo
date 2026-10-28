---
name: dsh-daily-report
description: Use when generating or inspecting a DeepSeek Harness daily work report from 08:30–18:00 Asia/Shanghai Session activity through the experimental daily-report Host service.
---

# Daily Work Report

Generate reports through the mounted `dailyReports` Host service. The [daily-report package](../../../packages/experimental/daily-report/README.md) owns the API, evidence window, persistence, and Schedule behavior. Do not invent a CLI command, read model credentials, or enable the Web UI: the profile disables `ui-daily-report` while keeping report generation and scheduling active.

## Generate a report

1. Confirm that the current composition provides `dailyReports`. If it is unavailable, report that the daily-report profile or its required Host services are missing; do not substitute a shell command or read report storage directly.
2. Call `dailyReports.generate({})` for today in Asia/Shanghai. For another workday, call `dailyReports.generate({ date: 'YYYY-MM-DD' })`. Await the returned durable attempt rather than treating submission as completion.
3. Present only the returned `completed`, `inProgress`, `blocked`, and `followUp` arrays. Use `sources` for Session links. Do not add repositories, outcomes, blockers, or plans that the source activity does not explicitly support.
4. Check `status` before reporting success. `completed` contains model-generated sections, `empty` means the evidence window had no eligible activity and no model request occurred, and `failed` includes an `error`. Never present an empty or failed attempt as a completed report.

The service collects `user/message` and `assistant/message` text from current logical Sessions in the half-open interval [08:30, 18:00) Asia/Shanghai. It excludes the dedicated `daily-report` Session, ignores tool-only activity, and retains at most 24,576 UTF-8 bytes per source Session by default. Manual generations run serially.

## Inspect history and scheduling

Call `dailyReports.list()` to read durable attempts newest first. Every generation attempt is stored in version 1 of the `daily_report` storage domain, table `reports`, with its id, work date, generation time, manual or Schedule trigger, status, four sections, source Session ids and titles, and optional error. The dedicated `daily-report` Session separately retains the model-visible report prompt in its ordinary Session log.

The Host service maintains one daily Schedule at 18:00 Asia/Shanghai for the dedicated Session. Scheduled generation uses the same 08:30–18:00 evidence window. Keep this Host service and Schedule enabled even though the Web navigation entry is disabled.
