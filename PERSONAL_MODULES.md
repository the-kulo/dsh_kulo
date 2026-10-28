# 个性化模块拆分（相对 DSH 上游）

基线：上游 `22ddee3792`。本仓库在其上新增了以下 8 个可独立维护的模块。
每个模块标注负责文件、职责与依赖，用于按模块分派 agent 维护。

## 共享底座（多模块依赖，建议归一个底座 agent 统一维护）

以下被多个模块依赖，其它模块 agent 只读不改，避免冲突：

- `packages/client/ui-conversation/` — 「对话/轨迹」页签注册机制（`contract/commands.ts`）
- `packages/client/ui-workspace/` — 侧栏布局
- `packages/subagent/tool-subagent/` — 子智能体模型选择
- `packages/api/remotes/` — 模型网关路由（Lakala / Kimi 接入，默认 k3.1-pro）
- `packages/client/ui-commands/` — `+` 菜单 / 命令面板
- `packages/preset/` — Agent 预设注册与展示

## 模块清单

### 1. 轻问答（Quick QA）
- 文件：`packages/client/ui-quick-qa/`（全部）、`packages/bundle/web-app/presets/quick-qa.patch.yml`
- 职责：无工具/无项目上下文的快速问答预设；左侧栏只读历史区；与工作区 50/50 分高、各自独立滚动
- 依赖：底座（ui-workspace 布局、preset）

### 2. 会话管理（Session management）
- 文件：`packages/client/ui-workspace/`（含 `session-actions/DeleteSession.tsx`）、`packages/api/session-controller/`、`packages/workspace/workspace/`
- 职责：会话删除（UI + Host 删除接口）；侧栏工作区浏览区布局
- 依赖：`api/session-controller`、`session/session-persistence`

### 3. 工作方式页签（Work-mode history tabs）
- 文件：`packages/client/ui-conversation/`、`packages/client/ui-subagent/`（`SubagentHistoryView`）、`packages/experimental/client-ui-agent-team/`（`TeamHistoryView`）、`packages/experimental/client-ui-discussion-room/`（历史页签）
- 职责：团队/子智能体/讨论室做成与「对话/轨迹」同级的历史页签；`+` 菜单与标题行重复入口已移除
- 依赖：底座（ui-conversation 页签机制）

### 4. 子智能体模型池（Model Pool）
- 文件：`packages/client/ui-settings-subagent/`（`ModelPoolSection.tsx` + `SubagentModelSelectionFields`）、`packages/subagent/tool-subagent/`（model-selection 系列）
- 职责：按用途把模型分池；子智能体按各 LLM 特长自动选模型；Lakala 模型入池
- 依赖：底座（tool-subagent、api/remotes）

### 5. Token 用量统计（Token usage）
- 文件：`packages/client/ui-settings-usage/`（全部）、`packages/session-query/session-query/`（用量聚合查询）
- 职责：设置里独立的 Token 用量仪表板；上海时区按日、按提供商/模型聚合；GitHub 提交式日历热力图
- 依赖：`session-query`、`session/session-persistence-jsonl`

### 6. 多模型讨论室（Discussion room）
- 文件：`packages/experimental/discussion-room/`（Host 服务）、`packages/experimental/client-ui-discussion-room/`（UI）、`packages/experimental/discussion-room-profile/`（预设）
- 职责：选多个模型就一个问题互相辩论，汇总结论/分论点
- 依赖：底座（tool-subagent、ui-conversation）

### 7. 智能体团队（Agent team）
- 文件：`packages/experimental/client-ui-agent-team/`
- 职责：智能体团队面板；共享任务；历史页签
- 依赖：底座（tool-subagent、ui-conversation）

### 8. 模型接入与命令系统（底座业务面）
- 文件：`packages/client/ui-commands/`、`packages/api/remotes/`、`packages/preset/`、`packages/core/`
- 职责：Lakala/Kimi 模型网关接入；默认模型 k3.1-pro；`+` 菜单改造
- 依赖：无（底层）

## Agent 分工建议

| Agent | 模块 | 上下文最小集 |
|---|---|---|
| A | 轻问答 | `ui-quick-qa` + quick-qa.patch.yml |
| B | 会话管理 | `ui-workspace` + `session-controller` |
| C | 工作方式页签 | `ui-conversation` + 三个 HistoryView |
| D | 模型池 | `ui-settings-subagent` + `tool-subagent` |
| E | Token 用量 | `ui-settings-usage` + `session-query` |
| F | 讨论室 | `discussion-room` 三件套 |
| G | 智能体团队 | `client-ui-agent-team` |
| H | 底座 | `ui-commands` + `api/remotes` + `preset` |

## 已移除

- **每日工作日报**：已删除（`daily-report/`、`client-ui-daily-report/`、`daily-report-profile/`、`.agents/skills/dsh-daily-report/` 及全部引用），build 10 gates 通过。
