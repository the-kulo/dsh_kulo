---
description: "Run bounded multi-model discussions with durable prompts, contributions, failures, and moderated recommendations."
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-discussion-room

English | [中文](README.zh.md)

## Summary

`dsh-experimental-discussion-room` runs a fixed discussion in one root Session: independent first-round opinions, bounded rebuttals, and an independent moderator's final recommendation. It uses Agent Teams root authorization and managed subagent activations rather than another Agent lifecycle.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## Use this package

Enable `@deepseek-ai/dsh-experimental-discussion-room-profile` after `dsh-base`. The Web header action creates a room in the current root Session with a topic, at least two model/role participants, a moderator, a round limit, and a per-response output-token limit. The bundle defaults to two rounds and prefers a catalog model named Lakala in the creation form; an unavailable Lakala leaves the deployment's default model selected instead.

Round one contains initial opinions. Every later round contains rebuttals that receive the settled transcript. Participants in a round run concurrently. A failed participant remains visible and does not prevent the moderator from running. The moderator must produce consensus, a unified recommendation, remaining disagreements, and each participant's position. Its failure marks the room failed. Stop cancels active activations and retains completed messages.

The root Session stores whole room checkpoints in `plugin:discussion-room/state` and publishes the `discussionRoom` projection. Every model contribution has its own child Session, which stores its exact user prompt, selected provider/model/token route, assistant response, failures, and usage through the ordinary Agent loop. Each activation uses caller delivery and is disposed after capture. Usage is not copied into the room projection.

### Configuration

| Field | Default | Meaning |
|---|---|---|
| `provider` | `spawn` | Local subagent provider for every contribution |
| `maxParticipants` | `6` | Maximum logical participants |
| `maxRoundLimit` | `5` | Maximum accepted rounds including initial opinions |
| `maxTokenLimit` | `32768` | Maximum accepted output-token cap per response |
| `maxPromptBytes` | `131072` | Maximum UTF-8 bytes in one generated prompt |

## Model Experience

### Discussion prompts

#### What the model sees

Participants receive their name, role, topic, and round-specific instructions. Rebuttals and moderation also receive settled participant messages and failures as JSON. The moderator receives explicit sections for consensus, final recommendation, remaining disagreements, and participant positions. Room checkpoints never enter model history; child Sessions own all model-visible prompts.

#### Token effect

The first round costs one request per participant. Each additional round costs one request per participant with a larger transcript, and moderation costs one final request. `tokenLimit` caps output tokens for every request, including the moderator. Input tokens grow with retained opinions and rebuttals.

#### KV Cache effect

Each contribution is a fresh child Session. It cannot reuse another participant's or an earlier round's child-session prefix; this isolation keeps attribution and model routes explicit at the cost of repeated prompt processing.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- One root Session has one room and rooms do not resume automatically after process interruption. An interrupted running room is marked failed.
- Each contribution starts a fresh child rather than continuing one participant Agent. Transcript growth is bounded by participant, round, and prompt-byte limits, not by semantic compaction.
- Only local continuable subagent providers with `agentOptions` support are suitable; the bundle selects `spawn`.
- Participant failures use the managed subagent's safe terminal diagnostic when available; provider errors without a diagnostic have a generic failure description.
- This experimental package has no stability promise and does not add itself to the default Web product.

### Dev Note

The service checkpoints each room before starting work, bounds concurrent contributions, and stops and drains activations on failure, stop, or plugin unload. Each contribution stores its actual route and response in a child Session.
