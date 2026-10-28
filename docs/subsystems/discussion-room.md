# Multi-model discussion rooms

English | [中文](discussion-room.zh.md)

The experimental discussion-room domain owns bounded model discussions rooted at one Session. [`packages/experimental/discussion-room/src/types.ts`](../../packages/experimental/discussion-room/src/types.ts) declares the Remote request and durable projection; the [package README](../../packages/experimental/discussion-room/README.md) owns orchestration, prompts, limits, and lifecycle behavior.

## Creation

A creation request names the topic, at least two participants with independent model routes and roles, an independent moderator, and output bounds. Round one contains opinions; subsequent rounds contain rebuttals. `tokenLimit` applies to every contribution, including moderation.

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

## Durable projection

`discussionRoom` publishes the current room or `null` when the Session has none. A room contains its immutable configuration, current round, status, and all attempted contributions. Each contribution carries its logical participant, kind, model route, child Session when admitted, captured text, and failure. `failure` on the projection itself reports an invalid durable plugin record rather than a model failure.

```ts type-equiv
/** Current room projection, including a durable decode failure. */
interface DiscussionRoomProjection {
  readonly room: DiscussionRoom | null
  readonly failure?: string
}
```

Root-owned `plugin:discussion-room/state` checkpoints never enter model history. Every model-visible prompt and its usage remains in the contribution's child Session. Fork-inherited checkpoints do not create a room in the fork.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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

Types: [Agent](core.md)

Source: [`packages/experimental/discussion-room/src/index.ts`](../../packages/experimental/discussion-room/src/index.ts)
<!-- END GENERATED cordis-surface -->
