---
description: "显式 opt-in 的日报 Host 调度与本地化 Web 客户端 Cordis bundle。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-daily-report-profile

[English](README.md) | 中文

## 概述

显式 opt-in 的 Cordis bundle，挂载日报 Host 服务并禁用其 Web 客户端。应用于已包含 AgentLoop、Schedule、session-query、会话持久化和存储的组合之后；不加入随附 profile。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## 使用本包

显式启用此 bundle。补丁选择 `lakala/LKL-GLM-5.2-FP8`、Asia/Shanghai、08:30 至 18:00 的活动窗口和 18:00 持久化 Schedule。禁用的 `ui-daily-report` 行不添加**工作日报**导航入口；Host API、持久化和 Schedule 仍保持启用。可在后续 profile 补丁中覆盖 `daily-report` 行来修改部署设置。

<a id="model-experience"></a>
## 模型体验

### 挂载的日报服务

#### 模型看到的内容

仅看到所挂载日报服务生成的、有上限的活动转录和 JSON 输出指令；此 bundle 不添加独立提示词。

#### Token 影响

每次非空日报生成调用一次模型。此 bundle 自身不增加请求。

#### KV 缓存影响

每次生成使用新的请求系列且不调用工具。此 bundle 不改变缓存。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与后续工作

- 此 bundle 不安装模型提供方或存储后端；基础组合必须提供这些能力。
- 专用日报会话是 Host 级单例，不按用户隔离。

### 开发备注

bundle 在现有组合中插入 Host `daily-report` 服务及其客户端行；模型与存储提供方仍由部署组合负责。
