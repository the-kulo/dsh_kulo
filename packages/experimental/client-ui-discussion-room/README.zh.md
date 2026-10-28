---
description: "从 Web 会话头部创建、查看和停止多模型讨论。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-client-ui-discussion-room

[English](README.md) | 中文

## 概述

此浏览器插件在会话头部添加本地化的讨论室操作。它通过生成的 Host Remote 创建房间，并且只读取持久 `discussionRoom` Session projection。

## 目录

- [使用此包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与暂缓工作](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## 使用此包

启用 `@deepseek-ai/dsh-experimental-discussion-room-profile`。对话与轨迹旁的独立 Discussion 页签通过 `discussionRoom` projection 渲染持久 `plugin:discussion-room/state` 记录，包含运行中与已落定的发言，不提供创建或停止控件。它不扫描 Session 事件，也不在客户端 store 中保存业务状态。

<a id="model-experience"></a>
## 模型体验

### 讨论室展示

#### 模型看到的内容

此包不添加模型输入。Host 包负责提示和持久子 Session；浏览器只读取 `discussionRoom`。

#### Token 影响

查看和编辑对话框不会发起模型请求。创建房间后发起 Host 包所述的请求。

#### KV Cache 影响

浏览器不影响模型前缀缓存。子 Session 隔离和重复记录处理由 Host 包负责。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与暂缓工作

- 最小视图以预格式文本显示消息，不支持 Markdown 或子会话导航。
- Remote 回复丢失会显示操作错误；持久 projection 始终是权威状态。

### 开发备注

profile 挂载 Host 讨论服务和此客户端。浏览器先挂载生成的 Remote，再注册本地化会话操作，卸载时一并移除。
