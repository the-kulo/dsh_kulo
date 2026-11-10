# @deepseek-ai/dsh-git

Git capability seam for the DeepSeek Harness: binds a workspace folder to a
remote git address, reports the working tree for the right-sidebar git tree,
and auto-generates git commits for each change.

## What it does

The package bundles three roles in one:

- **Service Definition** — the abstract `GitService` class and its request/result
  types, cordis events, and typed error classes.
- **Local Provider** — `LocalGitService` runs the resolved git executable through
  the `subprocess` capability with bounded output, timeouts, and cancellation.
- **Auto-commit Consumer** — listens for `turn/end` session events and creates a
  commit in the matching workspace when a git binding with `autoCommit: true` is
  present.

## Service API

| Method | Description |
|--------|-------------|
| `discover(directory, signal?)` | Find the repository enclosing a directory; returns `undefined` when none. |
| `bind(request, signal?)` | Initialize git in a directory, set origin remote, and checkout the branch. |
| `status(directory, signal?)` | Report the complete working-tree status through `git status --porcelain=v2 --branch -z`. |
| `commit(request, signal?)` | Stage all changes and commit with identity overrides; returns `{ committed: false }` when clean. |
| `log(directory, limit, signal?)` | List the `limit` most recent commits, newest first. |

## Events

| Event | Mode | Payload |
|-------|------|---------|
| `git/changed` | emit | `{ directory: string }` — the working tree or index changed. |
| `git/committed` | emit | `{ directory: string, commit: GitCommit }` — a commit was created. |

## Configuration

```ts
interface Config {
  executable: string         // default 'git'
  timeoutMs: number          // default 30000
  outputMaxBytes: number     // default 8 MiB
  stderrTailBytes: number    // default 16384
  terminateGraceMs: number   // default 2000
  autoCommit: {
    enabled: boolean         // default true
    debounceMs: number       // default 2000
    authorName: string       // default 'DeepSeek Harness'
    authorEmail: string      // default 'dsh@localhost'
  }
}
```

All numeric fields must be positive safe integers; invalid values fail plugin
load with a loud error. When the git executable is absent, the plugin loads
normally but every operation throws `GitUnavailableError`.

`stderrTailBytes` controls the retained stderr tail for diagnostics in
`GitCommandError`. `terminateGraceMs` is the grace period in milliseconds
for git child process termination after cancellation.

The `autoCommit` consumer requires the `workspaceRegistry` service. When
`autoCommit.enabled` is true and `workspaceRegistry` is unavailable, the
plugin fails at load. When `autoCommit.enabled` is false, the dependency is
not required.

## Model Experience

The auto-commit consumer generates commits with the message
`dsh: turn N — M file(s) changed`. These commits are purely local; they are
never pushed automatically and the model does not see them (no session event
is added for commits).

The `git/changed` and `git/committed` events are Host-side only — they do not
enter the session log and are not model-visible.

## Known Limitations and Deferred Work

- Commit author identity comes from the configured `authorName`/`authorEmail`;
  per-workspace identity is deferred.
- The provider does not push commits; push is deferred to a future consumer.
- The local provider uses the host filesystem's `realpath` for path
  canonicalization, so it runs only on the Harness host.
- `WorkspaceGitBinding` is owned by `@deepseek-ai/dsh-workspace/types`; this
  package consumes it type-only and stores no binding state of its own.
