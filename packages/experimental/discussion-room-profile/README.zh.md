---
description: "有界多模型讨论及其 Web 界面的显式启用组合包。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-discussion-room-profile

[English](README.md) | 中文

## 概述

此实验组合包组合 Agent Teams 根会话授权、讨论室编排和本地化 Web 创建/房间对话框，不属于默认 Web 组合。

## 目录

- [使用此包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与暂缓工作](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## 使用此包

在 `$DSH_HOME/profiles/<name>/package.json` 的 `dsh.profile.bundles` 中添加 `@deepseek-ai/dsh-experimental-discussion-room-profile`，然后重启该 profile。应在 `dsh-base` 后应用，以便持久 Session、LLM 注册表、subagent 和 Web 服务已就绪。配置层插入 `agent-team`、`discussion-room` 和 `ui-discussion-room`，后续 profile 补丁可按 id 覆盖。

[Host 包](../discussion-room/README.zh.md)负责轮次、提示、限制、失败和持久化；[Web 包](../client-ui-discussion-room/README.zh.md)负责创建和展示。

<a id="model-experience"></a>
## 模型体验

### 讨论室组合

#### 模型看到的内容

组合包不直接添加模型输入。`discussion-room` Host 包负责所有模型可见提示；启用组合包不会改变其他 Session 的提示或工具列表。

#### Token 影响

用户创建房间前不发起请求。Host 包负责后续请求的数量和大小。

#### KV Cache 影响

组合包没有独立缓存行为。Host 包为每次贡献创建隔离子 Session。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与暂缓工作

- 组合包依赖 `dsh-base` 和本地 `spawn` subagent provider，不安装模型 provider 或凭据。
- 它不集成默认产品，也不从其他讨论格式自动迁移。

### 开发备注

profile 组合 Agent Teams、讨论服务和 Web 客户端。模型凭据、存储和 `spawn` provider 仍由部署组合负责。
