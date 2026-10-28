---
description: "本地化 Web 日报历史、手动生成与来源会话导航。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-client-ui-daily-report

[English](README.md) | 中文

## 概述

新增本地化 Web 面板，用于查看持久化日报、手动生成、空日/失败状态，并跳转到每个来源会话。业务数据来自 `dailyReports` Remote；此包不拥有日报生成规则。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## 使用本包

日报 profile 禁用 `ui-daily-report`，因此 Web 导航不显示**工作日报**入口。部署显式启用此行后，可通过面板查看持久化尝试并生成今日日报；每个来源链接打开对应 Session，不修改报告内容。Host `dailyReports` API 独立于此客户端保持可用。

<a id="model-experience"></a>
## 模型体验

### Remote 报告数据

#### 模型看到的内容

不直接提供内容。此客户端只读取 Remote 报告数据，不发送模型请求或构造提示词。

#### Token 影响

渲染不新增消耗。手动生成调用 Host 服务，由所配置模型承担请求 Token。

#### KV 缓存影响

无。此客户端不改变请求缓存。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与后续工作

- 历史在面板订阅时、生成后或重连后读取；尚无跨客户端实时失效事件。

### 开发备注

profile 挂载一个 Host 服务，并将此客户端声明为禁用。部署显式启用此行后，浏览器代码使用生成的 Remote 描述符和普通 Session 导航。
