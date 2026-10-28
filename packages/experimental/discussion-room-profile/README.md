---
description: "Opt-in bundle for bounded multi-model discussions and their Web interface."
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-discussion-room-profile

English | [中文](README.zh.md)

## Summary

This experimental bundle combines Agent Teams root authorization, discussion-room orchestration, and the localized Web creation/room dialog. It is not part of the default Web composition.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

## Use this package

Add `@deepseek-ai/dsh-experimental-discussion-room-profile` to `dsh.profile.bundles` in `$DSH_HOME/profiles/<name>/package.json`, then restart that profile. Apply it after `dsh-base` so durable Sessions, the LLM registry, subagents, and Web services are present. The layer inserts `agent-team`, `discussion-room`, and `ui-discussion-room`; later profile patches can override those rows by id.

The [Host package](../discussion-room/README.md) owns rounds, prompts, limits, failures, and persistence. The [Web package](../client-ui-discussion-room/README.md) owns creation and presentation.

## Model Experience

### Discussion-room composition

#### What the model sees

The bundle adds no model input directly. Its `discussion-room` Host package owns all model-visible prompts; enabling the bundle does not change other Sessions' prompts or tool lists.

#### Token effect

No request starts until a user creates a room. The Host package owns the number and size of subsequent requests.

#### KV Cache effect

The bundle has no independent cache behavior. Its Host package creates isolated child Sessions for contributions.

## Known Limitations and Deferred Work

- The bundle requires `dsh-base` and the local `spawn` subagent provider. It does not install a model provider or credentials.
- It has no default-product integration or automatic migration from another discussion format.

### Dev Note

The profile composes Agent Teams, the discussion service, and the Web client. Model credentials, storage, and the `spawn` provider remain deployment responsibilities.
