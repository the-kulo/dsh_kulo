---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-27-subagent-model-selection

English | [中文](2026-10-27-subagent-model-selection.zh.md)

## Summary

Adds optional automatic model-routing metadata and a log-only automatic-selection event for delegated agents.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-10-27-subagent-model-selection
baseline: false
changes:
  - root: "event:subagent/model-auto-selection"
    previous: null
    after: "6bb7d1a9c6d09d92df7d738b03f50f4c32e96b10b0dad6f833fe00253ecd5a32"
    decision: same-version
  - root: "event:subagent/model-selection-policy"
    previous: "2026-09-11-initial"
    after: "39c61be10c8ce4ab086c8bc987e912ff3fa3988dda572c848e282f65ed0e3739"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Existing model-selection-policy records remain valid. Missing autoSelect defaults to false and missing modelCapabilities defaults to an empty list, preserving explicit-selection behavior. The automatic-selection event is additive and does not alter policy interpretation or model history.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/subagent/tool-subagent/tests/model-selection.spec.ts packages/subagent/tool-subagent/tests/model-selection-settings.spec.ts: 48 tests passed.

<a id="dev-note"></a>
## Dev Note

None.
