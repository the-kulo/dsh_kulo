# @deepseek-ai/dsh-client-ui-git

Right-sidebar Git panel and settings section for the DeepSeek Harness web client:
bind a workspace directory to a remote git repository, browse working-tree
changes, view recent commits, and commit on demand.

## What it does

- **Sidebar tab** — registers a `sidebar.right.pane.tab` contribution that opens
  the git panel for the selected workspace. The panel shows the binding form
  when the workspace is unbound, and the changed-files tree plus commit history
  when it is bound.
- **Settings section** — registers a `settings.section` contribution for
  choosing a workspace, editing the remote URL and branch, and toggling
  auto-commit.
- **Live status** — follows the Host `git` Remote namespace through the
  reconnecting `gitPanel` client service and renders the projected status view.

## Model Experience

This package is presentation-only. It adds no session events, no model-visible
input, and no token or KV-cache effect. Git status, binding state, and commit
history reach the browser through the `git` Remote namespace and are never
written into the Session log.

## Known Limitations and Deferred Work

- The panel stages and commits all working-tree changes; per-file staging and
  hunk selection are deferred.
- Conflict resolution is displayed as a file state only; no merge UI is provided.
- Commits stay local; push and pull are deferred to a future consumer.
- The relative commit timestamp is not localized; only the bare date fallback is
  locale-independent.
- Locale copy lives in inline dictionaries (`src/client/locales.ts` and
  `src/client/settings/locales.ts`); the package ships no `locale/*.json` plugin
  metadata, so the plugin title is not localized.
