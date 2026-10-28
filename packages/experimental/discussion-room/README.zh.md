---
description: "运行有界多模型讨论，持久保存提示、观点、失败与主持人统一建议。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-discussion-room

[English](README.md) | 中文

## 概述

`dsh-experimental-discussion-room` 在一个根 Session 中运行固定讨论：独立首轮观点、有界反驳，以及独立主持人的最终建议。它复用 Agent Teams 的根会话授权与 subagent activation 生命周期，不另建 Agent 生命周期。

## 目录

- [使用此包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与暂缓工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用此包

在 `dsh-base` 后启用 `@deepseek-ai/dsh-experimental-discussion-room-profile`。Web 会话头部操作可在当前根 Session 中创建房间，设置主题、至少两个模型/角色参与者、主持人、轮数上限和每次回复的输出 token 上限。组合包默认两轮，创建表单优先选择目录中名为 Lakala 的模型；没有可用的 Lakala 时保留部署默认模型。

第 1 轮是首轮观点，后续轮次是读取已落定记录的反驳。同一轮参与者并行运行。参与者失败后仍显示失败，主持人继续运行。主持人必须给出共识、统一建议、剩余分歧和各参与者立场；主持人失败则房间失败。停止操作取消活动 activation 并保留已完成消息。

根 Session 通过 `plugin:discussion-room/state` 保存完整房间检查点，并发布 `discussionRoom` projection。每次模型贡献有独立子 Session，通过普通 Agent loop 保存精确用户提示、provider/model/token 路由、助手响应、失败与 usage。activation 使用 caller delivery，结果捕获后释放。usage 不复制到房间 projection。

### 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `provider` | `spawn` | 每次贡献使用的本地 subagent provider |
| `maxParticipants` | `6` | 逻辑参与者上限 |
| `maxRoundLimit` | `5` | 接受的轮数上限，包含首轮观点 |
| `maxTokenLimit` | `32768` | 每次回复输出 token 上限的最大允许值 |
| `maxPromptBytes` | `131072` | 单个生成提示的 UTF-8 字节上限 |

<a id="model-experience"></a>
## 模型体验

### 讨论提示

#### 模型看到的内容

参与者看到自己的名称、角色、主题和本轮指令。反驳与主持总结还收到已落定参与者消息及失败的 JSON。主持人收到共识、最终建议、剩余分歧和参与者立场这些明确小节。房间检查点不进入模型历史；所有模型可见提示均属于子 Session。

#### Token 影响

首轮每位参与者一次请求；后续每轮每位参与者一次请求，记录更长；最后主持人一次请求。`tokenLimit` 限制包括主持人在内的每次请求输出 token。输入 token 随保留观点和反驳增加。

#### KV Cache 影响

每次贡献使用全新子 Session，不能复用其他参与者或前一轮子 Session 的前缀。这种隔离保证归因和模型路由明确，但会重复处理提示。

## 已知限制与暂缓工作

<a id="known-limitations-and-deferred-work"></a>

- 一个根 Session 只有一个房间，进程中断后不自动续跑；未结束房间会标记失败。
- 每次贡献启动新子 Agent，不延续同一个参与者 Agent。记录增长由参与者、轮数和提示字节上限约束，不做语义压缩。
- 仅适合支持 `agentOptions` 的本地 continuable subagent provider；组合包选择 `spawn`。
- 参与者失败优先使用 subagent 提供的安全终结诊断；没有诊断的 provider 错误显示通用失败说明。
- 此实验包不提供稳定性承诺，也不会加入默认 Web 产品。

### 开发备注

服务在启动工作前持久化房间检查点，限制并发贡献，并在失败、停止或插件卸载时取消并等待 activation 收尾。每次贡献的实际路由和响应保存在子 Session 中。
