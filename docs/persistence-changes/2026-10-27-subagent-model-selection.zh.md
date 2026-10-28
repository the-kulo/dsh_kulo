---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-27-subagent-model-selection

[English](2026-10-27-subagent-model-selection.md) | 中文

## 概述

为委托子代理增加可选的自动模型路由元数据，以及仅记日志的自动选择事件。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

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
## 兼容性

已有模型选择策略记录仍然有效。缺少 autoSelect 时默认为 false，缺少 modelCapabilities 时默认为空列表，保持显式选择行为。自动选择事件是新增记录，不改变策略解释或模型历史。

<a id="verification"></a>
## 验证

运行 pnpm exec vitest run packages/subagent/tool-subagent/tests/model-selection.spec.ts packages/subagent/tool-subagent/tests/model-selection-settings.spec.ts：48 个测试通过。

<a id="dev-note"></a>
## 开发备注

无。
