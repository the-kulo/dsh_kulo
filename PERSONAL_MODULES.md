# 个人定制 DSH（kulo）

这是基于 **DeepSeek Harness** 的个人定制版，在原项目之上做了一组面向个人工作流的功能改造，并裁剪为「代码 + 配置 + agent 约束」的精简仓库。

## Fork 基线

- 上游项目：[`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness)
- 上游版本：**v0.2.1-rc.3**
- 基线提交：`22ddee3792`（2026-10-23，该 tag 之后第 1533 个提交，merge PR #7075）
- 本仓库：[`the-kulo/dsh_kulo`](https://github.com/the-kulo/dsh_kulo)

## 分支

| 分支 | 内容 |
|---|---|
| `kulo-slim` | 精简版：源码 + 配置 + agent 约束（当前主用，约 7100 文件） |
| `feat/personal-cordis-workspace` | 完整版：含测试、文档、快照（约 19000 文件，用于回取测试） |

## 定制功能模块

以下是在上游之上新增/修改的功能，按模块拆分，便于每个模块交给独立 agent 维护。

### 共享底座（多模块依赖，归底座 agent 统一维护，其它模块只读）
- `packages/client/ui-conversation/` —「对话/轨迹」页签注册机制
- `packages/client/ui-workspace/` — 侧栏布局
- `packages/subagent/tool-subagent/` — 子智能体模型选择
- `packages/api/remotes/` — 模型网关路由（Lakala / Kimi 接入，默认 `k3.1-pro`）
- `packages/client/ui-commands/` — `+` 菜单 / 命令面板
- `packages/preset/` — Agent 预设注册与展示

### 1. 轻问答（Quick QA）
- 文件：`packages/client/ui-quick-qa/`、`packages/bundle/web-app/presets/quick-qa.patch.yml`
- 说明：无工具/无项目上下文的快速问答预设；左侧栏只读历史区；与工作区 50/50 分高、各自独立滚动。

### 2. 会话管理
- 文件：`packages/client/ui-workspace/`（含 `session-actions/DeleteSession.tsx`）、`packages/api/session-controller/`、`packages/workspace/workspace/`
- 说明：会话删除（UI + Host 删除接口）；侧栏工作区浏览区布局。

### 3. 工作方式页签
- 文件：`packages/client/ui-conversation/`、`packages/client/ui-subagent/`（`SubagentHistoryView`）、`packages/experimental/client-ui-agent-team/`（`TeamHistoryView`）、`packages/experimental/client-ui-discussion-room/`（历史页签）
- 说明：智能体团队 / 子智能体 / 多模型讨论室做成与「对话/轨迹」同级的历史页签；`+` 菜单与标题行的重复入口已移除。

### 4. 子智能体模型池（Model Pool）
- 文件：`packages/client/ui-settings-subagent/`（`ModelPoolSection.tsx` 等）、`packages/subagent/tool-subagent/`（model-selection 系列）
- 说明：按用途把模型分池；子智能体按各 LLM 特长自动选模型；Lakala 模型入池（省 Kimi 订阅额度）。

### 5. Token 用量统计
- 文件：`packages/client/ui-settings-usage/`、`packages/session-query/session-query/`
- 说明：设置里独立的 Token 用量仪表板；上海时区按日、按提供商/模型聚合；GitHub 提交式日历热力图。

### 6. 多模型讨论室
- 文件：`packages/experimental/discussion-room/`、`client-ui-discussion-room/`、`discussion-room-profile/`
- 说明：选多个模型就一个问题互相辩论，汇总结论与分论点。

### 7. 智能体团队
- 文件：`packages/experimental/client-ui-agent-team/`
- 说明：智能体团队面板、共享任务、历史页签。

### 8. 模型接入与命令系统
- 文件：`packages/client/ui-commands/`、`packages/api/remotes/`、`packages/preset/`、`packages/core/`
- 说明：Lakala / Kimi 模型网关接入；默认模型 `k3.1-pro`；`+` 菜单改造。

## 已移除的功能
- **每日工作日报**：已删除全部代码与引用（`daily-report/` 等），build 通过。

## 精简说明（相对完整版）
删除了：全部测试与 `test-support`、docs、website、snapshots、benchmarks、CI（.github）、上游历史决策记录（.agents/notes）、README 文档、非 build 核心脚本。

保留了：全部包/应用源码、配置（package.json / tsconfig / pnpm / tsdown / vite）、运行必需的 locale 文案、agent 约束（AGENTS.md / CLAUDE.md / .agents/skills）、build 核心脚本、vendor / native / patches / python。

注意：测试已移除，`pnpm run test` 不可用；如需给某模块补测试，从 `feat/personal-cordis-workspace` 分支回取对应模块测试。

## 构建
```sh
pnpm install
pnpm run build        # artifacts-only，8 个 gate
```

## 维护方式
每个模块一个 agent 维护；共享底座归底座 agent，其它模块只读不改，避免冲突。

## 安全约定
- `.npmrc` 与 API key 不入库。
- 模型 key 放在本机 `~/.dsh/profiles/web/cordis.patch.yml`（仓库外），不进 Git。
