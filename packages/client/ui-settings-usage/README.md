---
description: "Cross-Session provider token usage cache, Host Remote API, and localized Settings dashboard."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-usage

English | [中文](README.zh.md)

## Summary

Open **Settings → Token usage** to inspect provider-reported input, cached, output, and total tokens in a GitHub-style contribution calendar by Asia/Shanghai calendar day. Select a day to see its provider cards and the model table that preserves every actual provider/model route. The subagent model pool lives on its own **Settings → Model Pool** page, owned by the Subagent settings package.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

## Use this package

The calendar loads all recorded history by default; pick a date to restrict the query and reveal that day's details, or return to the full range with **All history**. The page covers provider usage present in available stored Session logs; it does not backfill unavailable history. A warning identifies usage omitted because no actual route was recorded. Loading, empty, and retryable error states appear in the section.

## Understand the implementation

The Host service reads `assistant/message` and `assistant/attempt` usage through `sessionPersistence`. Successful messages supply their actual `message.source` route; attempts use the latest durable `request/header`. The fold follows token-meter replacement and retry accounting, skips inherited fork prefixes, and stores per-Session incremental checkpoints in the `token_usage_dashboard` storage domain. Revision checks prevent caching a changing log under a newer revision.

`usageDashboard.summary` aggregates the cached rows by Shanghai day and provider/model, combining every Session into one row per exact route. The Client registers a localized `settings.section` contribution and calls the namespace mounted once by the global `api/remotes` assembly; it does not mount a duplicate Remote. The contribution calendar buckets each Shanghai day's total tokens into a five-level intensity scale inside a horizontally scrollable week grid.

## Model Experience

### Usage accounting

#### What the model sees

Nothing. `usageDashboard.summary` aggregates existing Session usage and does not add model input or send provider requests.

#### Token effect

None on generation. The dashboard only reports provider-recorded input, cached, output, and total tokens.

#### KV Cache effect

None. Cached tokens are read from provider usage; this package does not alter request caching.

## Known Limitations and Deferred Work

- **Provider data only** — requests without provider usage or an actual route cannot be fully attributed.
- **Cache is derived data** — a failed cache write fails the query rather than serving stale totals; a later query replays the log tail.

### Dev Note

The Web bundle mounts one Host and Client row. The package exports the generated Typert Host and Remote faces used by the Gateway.
