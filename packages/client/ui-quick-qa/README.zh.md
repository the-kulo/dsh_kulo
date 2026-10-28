---
description: "dsh Web 客户端的轻问答侧边栏历史区：只读展示从新任务输入区发起的持久化无工具 quick-qa 会话。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-quick-qa

[English](README.md) | 中文

## 概述

轻问答在 Workspace 浏览器下方以只读历史区展示持久化的轻问答会话；两个区域在侧边栏高度中各占一半，并各自独立滚动。提问在普通新任务输入区进行，选择 `quick-qa` Agent preset 后发送；侧边栏在重新加载后恢复最近一次轻问答 Session，页面加载不会创建 Agent，也不挂载工具或项目上下文插件。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

开始新任务时在 Agent preset 选择器中选择**轻问答**，从普通输入区发送问题。Workspace 与 Session 浏览器下方的**轻问答**区域展示该会话的持久化历史；它不提供提问输入、发送/停止或模型选择。

### 何时选择

一般问题不需要仓库文件、AGENTS 说明、工作目录上下文、技能或工具时，使用轻问答。编程和其他项目工作使用普通的 Workspace Session。

### 最小配置

本包没有插件配置。随附的 Web bundle 默认启用该条目；也可以通过 profile patch 显式控制：

```yaml
- id: ui-quick-qa
  disabled: false
```

bundle 还组合了随附的 `quick-qa` Agent preset，它会出现在交互式 preset 选择器中。它只增加 persona 系统文本，禁用运行时上下文，并且不挂载工具、项目说明或技能插件。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

浏览器控制器刷新 Host Session 列表，并恢复列表中最近的轻问答 Session：独立的 `quickqa-` 身份，或 `agentPreset` projection 记录为 `quick-qa` 的普通 Session。恢复是只读的——页面加载不会创建 Session 或 Agent，没有历史时显示空状态。

历史区 retain 该 Session，并从 Client 的持久化事件窗口派生问答记录，因此重新加载后会重建相同的已落定问答。界面文案由 locale 持有，长文本会换行。面板与 Workspace 浏览器通过从 0 起算的等权 flex 各分侧边栏区域高度的一半：无论内容长短各得一半，并各自滚动自己的溢出；96px 下限保证历史区在很矮的侧边栏中仍可用，此时浏览器区域获得其余高度。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

以下页面持有相邻的组合与持久化行为。

- [ui-workspace](../ui-workspace/README.zh.md)——在 Session 列表下方声明底部 slot 的浏览器。
- [Session Controller](../../api/session-controller/README.zh.md)——历史恢复读取的持久化 Session 列表与 retain 操作。
- [Web app bundle](../../bundle/web-app/README.zh.md)——随附的插件与轻问答 preset 组合。
- [Agent preset](../../preset/agent-preset/README.zh.md)——隔离的插件组合机制。

-----

<a id="model-experience"></a>
## 模型体验

通过普通持久化 Session 的提问流程间接影响模型；quick preset 持有最小模型上下文，只读历史区本身不向任何请求添加内容。

#### KV Cache 影响

没有独立缓存策略；回答沿用所属 Session 的普通持久化历史与请求行为。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些限制只涉及侧边栏展示，不影响模型使用的持久化 Session。

- **每个 Host 目录只有一个轻问答会话**——历史区恢复列表中最近的轻问答 Session，不提供多个独立轻问答线程。
- **不向前分页显示历史**——历史区渲染 Session 当前已加载的事件窗口，不请求更早的分页。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
