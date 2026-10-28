---
description: "跨会话提供商 Token 用量缓存、Host Remote API 与本地化 Settings 仪表板。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-usage

[English](README.md) | 中文

## 概述

打开 **Settings → Token 用量**，在 GitHub 风格贡献日历中按上海时区日期查看提供商报告的输入、缓存、输出和总 Token。选择某天可查看该日的提供商卡片和保留每条实际提供商/模型路由的模型明细表。子代理模型池由 Subagent 设置包独立承载，位于 **Settings → Model Pool** 页面。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## 使用本包

日历默认加载全部已记录历史；选择日期可限制查询并显示当日详情，点击**全部历史**返回完整范围。页面只覆盖现有会话日志中记录的提供商用量，不回填缺失历史。缺少实际路由的用量会显示未计入警告。加载、空状态和可重试错误状态均显示在分区内。

<a id="understand-the-implementation"></a>
## 理解实现

Host 服务通过 `sessionPersistence` 读取 `assistant/message` 和 `assistant/attempt` 的用量。成功消息使用实际 `message.source` 路由，尝试事件使用最近的 durable `request/header`。聚合遵循 token-meter 的样本替换与重试计数语义，跳过 fork 继承前缀，并把每个会话的增量检查点保存到 `token_usage_dashboard` storage domain。revision 检查避免把变化中的日志错误标记为新版本缓存。

`usageDashboard.summary` 按上海日期和提供商/模型聚合缓存行，把所有 Session 合并为每个精确路由的一行。Client 注册本地化 `settings.section`，并调用全局 `api/remotes` 只挂载一次的 namespace，不重复挂载 Remote。贡献日历把每个上海日期的总 Token 归入五级强度刻度，在可横向滚动的周网格中展示。

<a id="model-experience"></a>
## 模型体验

### 用量统计

#### 模型看到的内容

无。本包聚合现有会话用量，不添加模型输入，也不发送提供商请求。

#### Token 影响

不新增生成消耗。仪表板只报告提供商记录的输入、缓存、输出和总 Token。

#### KV 缓存影响

无。缓存 Token 直接读取提供商用量，本包不改变请求缓存。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与延期工作

- **仅使用提供商数据**——没有提供商用量或实际路由的请求无法完整归因。
- **缓存是派生数据**——缓存写入失败会使查询报错，而不是返回过期总量；后续查询会重放日志尾部。

### 开发备注

Web bundle 挂载同一 Host 与 Client 行。包导出 Gateway 使用的 Typert Host 与 Remote 生成接口。
