---
description: "Quick answers sidebar history for the dsh web client: a read-only view over durable tool-free quick-qa conversations started from the new-task composer."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-quick-qa

English | [中文](README.zh.md)

## Summary

Quick answers shows the durable quick-answer conversation in a read-only history below the Workspace browser; the two regions split the sidebar height in half and scroll independently. Questions are asked from the ordinary new-task composer with the `quick-qa` Agent preset selected; the sidebar restores the latest resulting Session across reloads, without creating an Agent on page load and without mounting tools or project-context plugins.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Pick **Quick answers** in the Agent preset selector when starting a new task, and send the question from the ordinary composer. The **Quick answers** section below the Workspace and Session browser shows that conversation's durable history; it carries no question input, send/stop, or model selection.

### When to choose it

Use Quick answers for general questions that need no repository files, AGENTS instructions, working-directory context, skills, or tools. Use an ordinary Workspace Session for coding and other project work.

### Minimal configuration

The package has no plugin configuration. The shipped Web bundle enables the entry; a profile patch can control it explicitly:

```yaml
- id: ui-quick-qa
  disabled: false
```

The bundle also composes the shipped `quick-qa` Agent preset, offered by interactive preset pickers. Its persona is the only added system text, runtime context is disabled, and no tool, project-instruction, or skill plugins are mounted.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The browser controller refreshes the Host Session list and restores the newest listed Session that is a quick-answer one: an independent `quickqa-` identity, or an ordinary Session whose `agentPreset` projection records `quick-qa`. The restore is read-only — page load never creates a Session or an Agent, and an empty result renders the empty state.

The history retains the Session and derives exchanges from the Client's durable event window, so reloads reconstruct the same settled questions and answers. UI copy is locale-owned and long text wraps. The panel and the Workspace browser split the sidebar region through equal zero-basis flex halves: each keeps half whether its content is short or long, and each scrolls its own overflow; a 96px floor keeps the history usable in a very short sidebar, where the browser's region takes the rest.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

These pages own the adjacent composition and durable behavior.

- [ui-workspace](../ui-workspace/README.md) — the browser that declares the footer slot below its Session list.
- [Session Controller](../../api/session-controller/README.md) — the durable Session list and retain operations the restore reads.
- [Web app bundle](../../bundle/web-app/README.md) — the shipped plugin and quick preset composition.
- [Agent preset](../../preset/agent-preset/README.md) — the isolated plugin composition mechanism.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the ordinary durable Session prompt flow; the quick preset owns the minimal model context and the read-only history adds nothing to any request.

#### KV Cache effect

No separate cache policy; answers use the owning Session's ordinary durable history and request behavior.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits concern the sidebar presentation, not the durable Session used by the model.

- **One quick conversation per Host catalog** — the history restores the newest listed quick-answer Session rather than offering separate quick threads.
- **Older display history does not page** — the history renders the Session's currently loaded event window and does not request older pages.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
