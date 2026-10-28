# 多模型讨论室

[English](discussion-room.md) | 中文

实验性讨论室领域负责以一个 Session 为根的有界模型讨论。[`packages/experimental/discussion-room/src/types.ts`](../../packages/experimental/discussion-room/src/types.ts)声明 Remote 请求与持久 projection；[包 README](../../packages/experimental/discussion-room/README.zh.md)负责编排、提示、限制和生命周期行为。

## 创建

创建请求指定主题、至少两个具有独立模型路由和角色的参与者、独立主持人以及输出限制。第 1 轮是观点，后续轮次是反驳。`tokenLimit` 适用于包括主持人在内的每次贡献。

```ts type-equiv
/** Browser request to start one bounded discussion in the addressed root Session. */
interface CreateDiscussionRoomRequest {
  readonly topic: string
  readonly participants: readonly DiscussionParticipantRequest[]
  readonly moderator: DiscussionModeratorRequest
  readonly roundLimit: number
  readonly tokenLimit: number
}
```

## 持久 projection

`discussionRoom` 发布当前房间；Session 没有房间时为 `null`。房间包含不可变配置、当前轮次、状态和全部已尝试贡献。每项贡献携带逻辑参与者、类型、模型路由、已接纳的子 Session、捕获文本和失败。projection 自身的 `failure` 表示持久 plugin record 无效，而不是模型失败。

```ts type-equiv
/** Current room projection, including a durable decode failure. */
interface DiscussionRoomProjection {
  readonly room: DiscussionRoom | null
  readonly failure?: string
}
```

根会话拥有的 `plugin:discussion-room/state` 检查点不进入模型历史。所有模型可见提示及 usage 均保留在贡献的子 Session 中。fork 继承的检查点不会在新 fork 中创建房间。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxdiscussionrooms--discussionroomservice"></a>

### `ctx.discussionRooms` — `DiscussionRoomService`

Host-owned discussion orchestration, persistence, cancellation, and Remote face.

```ts cordis-catalog
/**
 * Create and durably checkpoint one room, then run it in the background.
 * @param agent - exact live root Agent resolved from the addressed Session.
 * @param request - topic, routes, roles, and bounded rounds/output tokens.
 * @param signal - Remote cancellation before creation commits; it does not cancel an accepted room.
 * @returns the initial running room projection.
 */
@Remote('create') async create(agent: Agent, request: CreateDiscussionRoomRequest, signal: AbortSignal): Promise<DiscussionRoomProjection>

/**
 * Stop the addressed running room without deleting its completed contributions.
 * @param agent - exact live root Agent resolved from the addressed Session.
 * @returns the stopping or already-terminal room projection.
 */
@Remote('stop') async stop(agent: Agent): Promise<DiscussionRoomProjection>
```

Types: [Agent](core.zh.md)

Source: [`packages/experimental/discussion-room/src/index.ts`](../../packages/experimental/discussion-room/src/index.ts)
<!-- END GENERATED cordis-surface -->
