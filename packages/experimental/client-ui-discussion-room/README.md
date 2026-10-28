---
description: "Create, inspect, and stop multi-model discussions from the Web conversation header."
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-client-ui-discussion-room

English | [中文](README.zh.md)

## Summary

This browser plugin adds a localized discussion-room action to the conversation header. It creates rooms through the generated Host Remote and renders only the durable `discussionRoom` Session projection.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

## Use this package

Enable `@deepseek-ai/dsh-experimental-discussion-room-profile`. The Discussion tab beside Chat and Trajectory renders the durable `plugin:discussion-room/state` record through the `discussionRoom` projection, including running and settled contributions, without creation or Stop controls. It never scans Session events or stores business state in a client store.

## Model Experience

### Discussion-room display

#### What the model sees

The package adds no model input. Its Host package owns prompts and durable child Sessions; the browser reads only `discussionRoom`.

#### Token effect

Rendering and editing the dialog makes no model request. Creating a room starts the requests documented by the Host package.

#### KV Cache effect

The browser has no model-prefix cache effect. Child Session isolation and repeated transcript processing belong to the Host package.

## Known Limitations and Deferred Work

- The minimal view renders message text as preformatted text rather than Markdown and has no per-child navigation.
- A lost Remote reply is shown as an operation error; the durable projection remains authoritative.

### Dev Note

The profile mounts the Host discussion service and this client. The browser mounts the generated Remote before registering the localized conversation action and removes both on unload.
