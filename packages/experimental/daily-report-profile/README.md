---
description: "Opt-in Cordis bundle for daily-report Host scheduling and its localized Web client."
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-daily-report-profile

English | [中文](README.zh.md)

## Summary

Opt-in Cordis bundle that mounts the daily-report Host service and disables its Web client. Apply it after a composition containing AgentLoop, Schedule, session-query, Session persistence, and storage. It is not included in shipped profiles.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

## Use this package

Enable this bundle explicitly. Its patch selects `lakala/LKL-GLM-5.2-FP8`, Asia/Shanghai, activity from 08:30 until 18:00, and a durable 18:00 Schedule. The disabled `ui-daily-report` row adds no **Daily reports** navigation entry; the Host API, persistence, and Schedule remain active. Override the `daily-report` row in a later profile patch to change deployment settings.

## Model Experience

### Mounted report service

#### What the model sees

Only the mounted `daily-report` service's bounded activity transcript and JSON-output instructions. This bundle adds no independent prompt.

#### Token effect

One model request per non-empty report generation. This bundle adds no requests of its own.

#### KV Cache effect

Each generation uses a fresh request series and no tools. This bundle does not alter caching.

## Known Limitations and Deferred Work

- The bundle does not install a model provider or storage backend; the base composition must supply them.
- The dedicated report Session is a Host-wide singleton and is not isolated per user.

### Dev Note

The bundle inserts the Host `daily-report` service and its client row into an existing composition; model and storage providers remain deployment responsibilities.
