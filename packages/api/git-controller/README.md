# @deepseek-ai/dsh-api-git-controller

Host and Client faces for workspace git bindings: bind a workspace directory to a
remote git repository, inspect working-tree status and recent commits, commit on
demand, and stream live status changes over Typert Remote.

## What it does

- **Host** — `GitController` extends `TypertRemoteService`, namespaced `git`,
  providing the `ctx.remote.git` namespace. It calls through `ctx.git` (the git
  capability seam) and `workspaceRegistry` (durable binding storage).
- **Client** — `GitPanel` (service key `gitPanel`) holds the current workspace's
  git status and exposes a `useSyncExternalStore`-compatible `read`/`subscribe`
  surface for UI components. `follow(workspaceId)` opens a stream over
  `remote.git.watch()`; switching workspace aborts the previous stream.

## Remote API

| Method | Kind | Description |
|---|---|---|
| `status(workspaceId, signal)` | unary | Complete git status and recent commits. |
| `bind(workspaceId, input, signal)` | unary | Initialize git, configure remote, checkout branch, record binding. |
| `unbind(workspaceId, signal)` | unary | Clear the recorded binding without deleting the repo. |
| `setAutoCommit(workspaceId, autoCommit, signal)` | unary | Update only the auto-commit policy. |
| `commit(workspaceId, message, signal)` | unary | Stage all changes and commit. Throws `git/nothing-to-commit` when the tree has no changes. |
| `watch(workspaceId, signal)` | stream | Baseline status view, then a fresh view on each `git/changed` or `git/committed` event. |

## Client service

`ctx.gitPanel` implements `IGitPanel`:

```ts
interface IGitPanel {
  read(): GitPanelView
  subscribe(listener: () => void): () => void
  follow(workspaceId: WorkspaceId): Promise<void>
  refresh(): Promise<void>
  bind(input: GitBindInput): Promise<void>
  unbind(): Promise<void>
  setAutoCommit(autoCommit: boolean): Promise<void>
  commit(message: string): Promise<void>
}
```

`follow` opens a `RemoteStreamHandle` over `remote.git.watch()`. A workspace
switch aborts the previous stream's `AbortController`, disposes the handle, and
opens a new stream. The stream is driven asynchronously so `follow()` returns
without waiting for the first frame; the model transitions through `loading`
until the baseline arrives.

Unary commands (`bind`, `unbind`, `setAutoCommit`, `commit`, `refresh`) call
through `ctx.remote.git.<method>()` and install the returned `GitStatusView`
on success. On `ok: false` the model transitions to `error` with a readable
message and the caller receives a thrown `Error`.

## Configuration

- `maxCommits` (default 20): maximum number of recent commits returned in each
  status view. Must be a positive safe integer; fails loud at construction.

## Known Limitations and Deferred Work

- The `watch` stream does not filter duplicate status views: two rapid
  `git/changed` events for the same directory produce two status rebuilds. A
  future iteration could debounce or compare version tokens from `git status`.
- The feed uses a simple trigger-per-event model (a `Deque<void>` sentinel)
  rather than workspace-controller's typed increment frames. Each trigger
  causes a full status rebuild from `ctx.git.status()` and `ctx.git.log()`.
- `unbind` does not remove the remote or delete the `.git` directory — it only
  clears the durable binding on the workspace entity. A future command could
  offer repository deletion as an explicit separate operation.
