# AGENTS.md

DeepSeek Harness is an all-plugin Cordis agent harness. This checkout is a
pruned fork: the upstream `docs/` tree, `packages/README.md`, `.agents/notes/`,
and most root gate scripts are absent. Follow this file and the skills under
`.agents/skills/`; do not assume upstream documentation or the
`pnpm run test` / `lint` / `hygiene` scripts exist here.

## Checkout notes

- There is no `docs/` directory. Do not create links to `docs/...`; put durable
  prose in package READMEs or `.agents/skills/`.
- The root `package.json` defines build/package/release/dev scripts plus a few
  helpers (`change-scope`, `gen-provider-data`, `demo:inspector`, `dsh`,
  `verify-installer-locales`, `verify-provider-data`). The upstream `test`,
  `typecheck`, `lint`, `duplication`, `hygiene`, `doc-sync`, and `verify-*`
  scripts are not defined.
- `node_modules/.bin` provides `tsc`, `tsx`, `tsdown`, `vite`, and `pnpm`.
  `vitest` is declared by `apps/web`; run it from there (see Commands).
  `oxlint` is not installed.
- This branch's history is unrelated to `origin/master`; do not diff, merge, or
  rebase against it without re-establishing a base.
- Most packages have no README on this branch. When a package does have one,
  keep it current with behavior.

## Repository layout

```
vendor/      Vendored Cordis and foundation packages (private, rescoped):
             cordis, cosmokit, group, hmr, include, loader, logger-console,
             schemastery, timer
packages/    @deepseek-ai/dsh-<pkg> workspaces at packages/<group>/<pkg>/
  core/ api/ typert/ llm/ shell/ subprocess/ ssh/ terminal/ ptc-runtime/
  sandbox/ deliverables/ fs/ lsp/ skill/ web/ computer-use/ browser-use/
  compaction/ context/ subagent/ jobs/ bundle/ workflow/ todo/ plan/ goal/
  schedule/ preset/ guard/ extensions/ session/ session-query/ attachment/
  spill/ storage/ workspace/ identity/ settings/ credentials/ acp/
  interaction/ boot/ sdk/ host/ client/ mcp/ experimental/ git/ telemetry/
  document/ util/
apps/        cli, desktop, desktop-host, plugin-market-generator, web
python/      Python SDK/runtime (sdk, sdk-runtime)
native/      node-addon-system source (system)
scripts/     build/gate/generator scripts (TypeScript, run with tsx)
.agents/     Agent skills (.agents/skills/) and worktrees
website/     VitePress build outputs only
benchmarks/  performance fixtures (node_modules only)
```

## Commands

```sh
pnpm install
pnpm run build:artifacts     # tsc lib/types + tsdown runtime + Web
pnpm run build:lib:host      # tsc -p tsconfig.host.json + desktop bundle
pnpm run build:lib:client    # tsc -b tsconfig.client.json + tsdown client
pnpm run build:web           # apps/web production build
pnpm run clean
pnpm dsh --profile headless "task"   # run from source (needs DEEPSEEK_API_KEY)
pnpm run dev:desktop                # build, then launch Desktop
pnpm run start:web | start:desktop   # launch without building
pnpm --filter @deepseek-ai/dsh-<pkg> run bundle
pnpm --filter @deepseek-ai/dsh-<pkg> run watch
```

### Direct verification (the missing gate scripts)

```sh
# Typecheck one package and its project references
node node_modules/typescript/bin/tsc -b packages/<group>/<pkg> --pretty false

# Unit tests (vitest is declared by apps/web, not the root)
node apps/web/node_modules/vitest/vitest.mjs run packages/<group>/<pkg>/tests --reporter=dot

# Bundle one package
pnpm --filter @deepseek-ai/dsh-<pkg> run bundle
```

Run the narrowest check that covers the change. Do not run the whole tree
unless the change is repository-wide.

### Host sandbox failures

If a required `gh`, `pnpm`, build, or generator command fails because the
sandbox blocks credentials, network, IPC, watching, or nested `sandbox-exec`,
retry unchanged with the narrowest host escalation. Require sandbox evidence;
never bypass test failures or the product sandbox.

## Pre-stable APIs and released Session data

Public APIs are pre-stable; update every consumer. Never move, overwrite, or
delete committed Session format generations; predecessors imply neither fallback
nor downgrade support. SQLite uses monotonic `SCHEMA_VERSION`. Record each
externally perceptible breaking change immediately with the
[dsh-create-upgrade-guide](.agents/skills/dsh-create-upgrade-guide/SKILL.md)
skill.

**Application launch.** Only `dsh` profiles launch supported Node apps; package
bins, demos, and public SDK argv escapes are forbidden.

## Conventions

- Packages use `@deepseek-ai/dsh-<name>`; vendor is rescoped and `private: true`.
  Harness packages declare `@deepseek-ai/cordis` in
  `peerDependencies`/`devDependencies`. Workspace dependency sections use DSH
  `workspace:*`, vendor/native `workspace:~`.
- ESM everywhere (`"type": "module"`). Use package names across packages and
  `.ts` in local relative imports. The `dsh` CLI source launch runs through
  tsx's ESM-only hook (`node --import tsx/esm`); modules it reaches must stay
  ESM (no CJS-only exports).
- **Registrations are effects**: every contribution goes through
  `ctx.effect()` / `ctx.on()`; a registry's `register()` returns the disposer,
  directly or through its documented registration handle.
- **Typed events use declaration merging** and merge-extensible maps. Event
  JSDoc needs `@mode` and payload `@param`. Public service methods document
  parameters and non-void returns. `SessionEventMap` members are required-on-read
  unless the envelope carries `ignorable: true`. Bump `SESSION_FORMAT_VERSION`
  only when existing discriminators cannot prevent unsafe interpretation.
- **Switch on discriminant tags.** Closed unions end in `assertNever`;
  merge-extensible unions fall through a documented default.
- **Waterfall listeners MUST call `next()`** to delegate; returning without it
  short-circuits the chain.
- **Model-visible ⟺ logged**: anything that reaches a model request must be
  reconstructable from the session log; a new model-visible input requires a
  session event.
- **Plugins, not loop changes**: new behavior goes on documented extension
  points; changing `agent-loop` is a design decision that updates the
  architecture notes.
- **A capability seam comprises Service Definition / Service Provider /
  Consumer roles.** It is complete, never one role; split only when roles
  evolve independently.
- **No hardcoded tunables in plugins**: deployment-varying choices are validated
  `Config` fields changeable from cordis.yml; a `DEFAULT_*` constant or test
  hook is not configurability. Protocol constants, external specs, and security
  invariants stay fixed.
- **Misconfiguration fails loud** at load when self-contained, otherwise at the
  earliest resolvable point; never silently skip a missing referent.
- **Opaque cross-boundary ids are branded** (`Branded<B>` from `dsh-brand`),
  never bare `string`.
- **Trust TypeScript at typed same-process boundaries.** Do not add runtime
  validation, fallback behavior, or hostile-input tests solely for values the
  static interface requires; validate at parser/config, queued, model/tool JSON,
  durable/file, worker, process, and wire boundaries.
- **No new assertions to `unknown`** (`as unknown` or `<unknown>`). Preserve or
  reduce the exact legacy baseline; use typed values or validation for
  replacements.
- **Error handling:** use typed, structured failures and localized, actionable
  reports. Follow
  [dsh-error-handling](.agents/skills/dsh-error-handling/SKILL.md).
- **An empty `catch` names the error** and why; keep its `try` to one statement.
- **Keep comments local.** Do not restate code, expand unrelated comments, or
  explain distant behavior without local need
  ([dsh-prose-standard](.agents/skills/dsh-prose-standard/SKILL.md)).
- **Client UI copy is locale-owned.** Route product text through typed
  dictionaries and `t` or localized primitive props; hardcoded copy is rejected
  by review. English copy, including plugin titles, uses sentence case.
- **Tests describe behavior, not correctness.** Change obsolete behavior with
  its tests. Fixtures replay on macOS/Linux; fix fixtures, not normalizers.
- **Choose PR history deliberately.** Split independent changes and fix the
  introducing PR before propagation. Rewrites use `--force-with-lease`, abort
  on remote movement, never raw `--force`.
- TODO markers: `FIXME`/`TODO`/`XXX` by urgency. Files end with exactly one
  trailing newline.

## Git integration

The harness has a Git capability seam:

- `packages/git/git` — `GitService` definition, `LocalGitService` provider over
  the subprocess capability, and the auto-commit consumer (`turn/end` → one
  debounced commit per bound workspace).
- `packages/api/git-controller` — Host `GitController` (`ctx.remote.git`) and
  the Client `GitPanel` service. The watch stream uses `remote.$stream` +
  `RemoteStream` so it reopens after a carrier loss.
- `packages/client/ui-git` — right-sidebar tab and settings section.
- `packages/workspace/workspace` — durable `WorkspaceGitBinding` on the
  workspace record.

## Locale policy

Only Simplified Chinese (`zh`) and English (`en`) ship.

- `scripts/shipped-locales.ts` owns `SHIPPED_LOCALE_IDS`; keep it `['en', 'zh']`.
- `packages/client/locale/src/locales/` holds the built-in dictionaries and
  registers only `zh`/`en`; the Language row offers exactly those.
- Every package's `locale/` directory carries `en.json` and `zh.json` metadata
  and no other language. Do not re-add `ja`/`es`/`fr`/`de`/`ru`/`pt`.
- Locale metadata is plugin `meta.title`/`meta.description`; UI copy lives in
  each feature's typed dictionaries.

## Defensive patterns and type safety

Read [dsh-error-handling](.agents/skills/dsh-error-handling/SKILL.md) and
[cordis-styling-nitpicking](.agents/skills/cordis-styling-nitpicking/SKILL.md)
before changing a package surface, remote service, client component, session
behavior, lifecycle, concurrency, subprocess, or teardown code.

Everything compiles under `strict: true` with `noImplicitAny`; every remaining
`any` explains why narrowing is infeasible. Every module and export has concise
JSDoc; function-like exports include `@param`/`@returns`. Comments state
contracts and context, not reasoning transcripts. Use
[dsh-prose-standard](.agents/skills/dsh-prose-standard/SKILL.md) for prose
decisions.

## Secrets / .env

Real-API runs read `DEEPSEEK_API_KEY`, optional `DEEPSEEK_BASE_URL`, and the
root `.env`. Never commit credentials. `cordis.yml` allows `!!js` (never
`!js`) under plugin `config` and entry `disabled`; other metadata stays
literal.

## Editing these instructions

Edit this file directly; this checkout has no `CLAUDE.md` symlink. Keep each
rule self-contained. Condense when clarity survives.

## Vendoring policy

`vendor/` packages are pinned source copies. Update them only through a careful
sync: re-apply or retire local modifications, then rerun the package builds and
tests that cover them.
