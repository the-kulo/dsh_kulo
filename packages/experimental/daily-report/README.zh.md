---
description: "带来源证据的每日工作日报、持久化历史与 18:00 定时任务。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-daily-report

[English](README.md) | 中文

## 概述

根据 Asia/Shanghai 每天 08:30 至 18:00 的用户与助手活动生成实验性工作日报。实现复用 `session-query`、专用 AgentLoop 会话、持久化 Schedule 投递和带版本的存储域。每次尝试都保存状态、四个日报栏目和来源会话 id，不迁移会话历史。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## 使用本包

通过 `@deepseek-ai/dsh-experimental-daily-report-profile` 挂载 `daily-report`；该 profile 为显式 opt-in，必须显式配置 `provider` 和 `model`。`ui-daily-report` 行处于禁用状态，因此 Web 导航不显示**工作日报**入口，Host 服务、持久化历史和 Schedule 仍保持启用。其他可配置项为 `timeZone`、`activeStart`、`scheduleTime` 和 `maxSessionBytes`。

`dailyReports.generate({ date? })` 手动生成，`dailyReports.list()` 按时间倒序返回持久化尝试。一个 Schedule 条目只绑定一次专用 `daily-report` 会话；启动时优先复用活动 Agent，恢复持久化会话，或首次创建。

<a id="model-experience"></a>
## 模型体验

### 日报提示词

#### 模型看到的内容

模型只接收当天用户与助手文本（每个会话有上限）以及要求返回四个严格 JSON 数组的指令。空日和来源读取失败不会调用模型。这些输入按普通 Session 日志保存在专用日报会话中。

#### Token 影响

每次非空日报使用一个新的请求系列。提示词 token 随保留活动增长；不调用工具。

#### KV 缓存影响

每次日报使用新的请求系列，不共享其他会话缓存。提供商报告的缓存用量仍记录在 Session 用量事件中。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与后续工作

- 不总结仅包含工具的活动。报告只归纳明确证据，不推断仓库或测试结果。来源标题缺失时回退为会话 id。
- 专用日报会话是 Host 级单例，不按用户隔离。持久化会话损坏时启动会明确失败，不会静默替换。

### 开发备注

服务拥有专用 Agent、日报存储域和每日 Schedule。启动时优先复用活动 Agent，恢复持久化会话，或首次创建。
