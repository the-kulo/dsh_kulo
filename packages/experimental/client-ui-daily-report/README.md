---
description: "Localized Web history, manual generation, and source-session navigation for daily work reports."
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-client-ui-daily-report

English | [中文](README.zh.md)

## Summary

Adds a localized Web panel for persisted daily reports, manual generation, empty/failed states, and navigation to every source Session. Business data comes from the `dailyReports` Remote; the package owns no report-generation rules.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

## Use this package

The daily-report profile disables `ui-daily-report`, so Web navigation shows no **Daily reports** entry. A deployment that explicitly enables this row can use the panel to inspect persisted attempts and generate today's report; each source link opens the corresponding Session without changing report content. The Host `dailyReports` API remains available independently of this client.

## Model Experience

### Remote report data

#### What the model sees

Nothing directly. `dailyReports` reads Remote report data and does not send model requests or construct prompts.

#### Token effect

None on rendering. Manual generation calls the Host service, whose configured model owns request tokens.

#### KV Cache effect

None. This client does not alter request caching.

## Known Limitations and Deferred Work

- History refreshes when the panel is subscribed and after generation or reconnection; there is no live cross-client invalidation event.

### Dev Note

The profile mounts one Host service and declares this client as disabled. Browser code uses the generated Remote descriptor and ordinary Session navigation when a deployment explicitly enables the row.
