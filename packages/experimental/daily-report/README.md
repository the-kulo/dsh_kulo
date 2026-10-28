---
description: "Evidence-linked daily work reports with durable history and an 18:00 schedule."
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-daily-report

English | [中文](README.zh.md)

## Summary

Generates an experimental daily work report from user and assistant activity between 08:30 and 18:00 in Asia/Shanghai. It uses `session-query`, a dedicated AgentLoop Session, durable Schedule delivery, and a versioned storage domain. Every attempt retains its status, four report sections, and source Session ids. It does not migrate Session history.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

## Use this package

Mount `daily-report` through `@deepseek-ai/dsh-experimental-daily-report-profile`; the profile is opt-in and must explicitly configure `provider` and `model`. Its `ui-daily-report` row is disabled, so Web navigation has no **Daily reports** entry while the Host service, durable history, and Schedule remain active. Other overrides are `timeZone`, `activeStart`, `scheduleTime`, and `maxSessionBytes`.

`dailyReports.generate({ date? })` generates manually. `dailyReports.list()` returns newest-first durable attempts. A Schedule row targets the dedicated `daily-report` Session once; startup reuses a live Agent, resumes a persisted one, or creates it on first use.

## Model Experience

### Report prompts

#### What the model sees

`dailyReports.generate` receives same-day user and assistant text, bounded per Session, plus instructions requiring four strict JSON arrays. Empty days and source-read failures do not call the model. The dedicated report Session preserves those inputs in the ordinary Session log.

#### Token effect

One fresh request series per non-empty report. Prompt tokens grow with retained activity; no tools are called.

#### KV Cache effect

Each report uses a fresh request series and does not share another Session's cache. Provider-reported cache usage remains in the Session's usage events.

## Known Limitations and Deferred Work

- Tool-only activity is not summarized. Reports classify only explicit evidence and do not infer repository or test outcomes. Source titles fall back to Session ids.
- The dedicated report Session is a Host-wide singleton and is not isolated per user. A corrupt persisted Session fails startup rather than being silently replaced.

### Dev Note

The service owns the dedicated Agent, report domain, and one daily Schedule. Startup reuses a live Agent, resumes a persisted Session, or creates it on first use.
