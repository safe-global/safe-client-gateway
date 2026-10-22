<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Agent Guidelines

> These documents describe **this repository** — its architecture, constraints, and conventions. They are not a workflow. Process skills and plugins you run (e.g. Superpowers, spec-kit) govern *how* you work; these guides define *what correct looks like here*. When a process skill needs repo specifics — verification commands, test conventions, architectural context — these guides are the answer.

## Read this first

| Your task touches | You MUST read first |
|---|---|
| Anything non-trivial (session start) | [docs/agents/ARCHITECTURE.md](docs/agents/ARCHITECTURE.md) |
| Any TypeScript code change (cross-cutting dos & don'ts) | [docs/agents/best-practices.md](docs/agents/best-practices.md) |
| Nest module, provider, guard, interceptor, pipe, filter, DI | [docs/agents/nestjs-patterns.md](docs/agents/nestjs-patterns.md) |
| Endpoint, DTO, controller, Swagger | [docs/agents/api-dtos-and-validation.md](docs/agents/api-dtos-and-validation.md) |
| Auth, signatures, guards, secrets, PII, cookies | [docs/agents/security.md](docs/agents/security.md) |
| New module, moving files, naming, versioning | [docs/agents/module-structure.md](docs/agents/module-structure.md) |
| Datasource, cache, upstream call, queue, perf | [docs/agents/caching-and-performance.md](docs/agents/caching-and-performance.md) |
| Migration, `*.entity.db.ts`, TypeORM | [docs/agents/database-and-migrations.md](docs/agents/database-and-migrations.md) |
| Any test file | [docs/agents/testing.md](docs/agents/testing.md) |
| Env var, feature flag, config | [docs/agents/configuration-and-flags.md](docs/agents/configuration-and-flags.md) |
| Reviewing a PR / verifying a completed task | [docs/agents/reviewing.md](docs/agents/reviewing.md) + [docs/agents/remarks.md](docs/agents/remarks.md) |
| Commit message, PR title, PR body, splitting a PR | [docs/agents/commits-and-prs.md](docs/agents/commits-and-prs.md) |
| Adding a skill, a slash command, or a hook (`.claude/settings.json`, `.husky/`) for this repo | [docs/agents/agent-tooling.md](docs/agents/agent-tooling.md) |

These rules apply to every agent, whichever one you are. The routing table above tells you which guide to read. "Pre-PR Architecture Review" below makes applying the review checklist to the whole branch mandatory before any push, and `.husky/pre-push` rejects a push that skipped it. On demand, commenting `@claude arch-review` on a PR runs the `Architecture Check` workflow, which applies the same checklist to the PR diff and posts a brief verdict comment. Each agent also gets this delivered automatically through whatever mechanism it reads. Each guide above is also a `cgw-*` skill in `.claude/skills/` that loads itself on the matching work. A `PreToolUse` hook in `.claude/settings.json` stops an unreviewed `git push` before it runs. There are no repo-specific slash commands to remember. Every mechanism is documented in [docs/agents/agent-tooling.md](docs/agents/agent-tooling.md).

## Non-negotiables

1. Every `@Param`/`@Query`/`@Body` goes through `new ValidationPipe(ZodSchema)` — no bare access. → [security.md](docs/agents/security.md)
2. Never call `fetch`/HTTP clients directly — outbound calls go through `INetworkService`/`CacheFirstDataSource`. → [caching-and-performance.md](docs/agents/caching-and-performance.md)
3. Datasources return `Raw<T>`; the owning repository must `Schema.parse()` before returning. → [api-dtos-and-validation.md](docs/agents/api-dtos-and-validation.md)
4. Imports use the `#/` alias only; import other modules only via their `domain/` — the sole exception being a guard another module applies, which is imported from where it lives. → [module-structure.md](docs/agents/module-structure.md)
5. New feature code goes in `src/modules/<kebab>/` following the canonical skeleton — never in `src/routes/`, `src/domain/`, or `src/datasources/`. → [module-structure.md](docs/agents/module-structure.md)
6. Test data comes from builders + faker — no literal fixtures. → [testing.md](docs/agents/testing.md)
7. Every env var is declared in `configuration.ts` AND `RootConfigurationSchema`; secrets never get fallback defaults. → [configuration-and-flags.md](docs/agents/configuration-and-flags.md)
8. Cache keys only via `CacheRouter`; TTLs only from config. → [caching-and-performance.md](docs/agents/caching-and-performance.md)
9. State-changing or caller-scoped routes declare an auth guard; identity comes from signature recovery or a verified JWT, never from client claims. Sensitive Workspace mutations additionally declare `ElevationGuard` and are recorded in the gated/ungated tables of `elevation.integration.spec.ts`. Workspace membership and admin checks go through `assertMember`/`assertAdmin` from `space-assert.utils.ts`, called from the route service — never a private re-implementation or a check inside a repository query. → [security.md](docs/agents/security.md)
10. One error funnel per layer: `HttpErrorFactory`/`DataSourceError` in datasources; domain errors + filters in `domain/`; `HttpExceptionNoLog` for expected rejections. → [api-dtos-and-validation.md](docs/agents/api-dtos-and-validation.md)

## Architecture

```
Controller → Route Service → Repository → Datasource → CacheFirstDataSource
```

Route services (`routes/*.service.ts`) call repositories (`domain/*.repository.ts`) — never datasources directly — and only a repository calls `Schema.parse()` on a datasource's raw output before trusting it as a domain entity. A new external API client belongs in that module's own `datasources/` (e.g. `src/modules/balances/datasources/coingecko-api.service.ts`); central `src/datasources/` is cross-cutting infrastructure only (cache, db, network, jwt, kms, job-queue, storage, circuit-breaker) plus a handful of legacy API clients not yet migrated — it is not the default home for a new implementation.

See [docs/agents/ARCHITECTURE.md](docs/agents/ARCHITECTURE.md) for the full request lifecycle, validation boundaries, and error funnels.

## Testing

- **Never call bare `await app.init()` in tests.** The HTTP platform is Fastify: route contexts only get their lifecycle hooks attached once Fastify's `.ready()` resolves, so a supertest request sent after `init()` alone races app boot and crashes inside Fastify's hook runner (`Cannot read properties of undefined (reading 'length')`), hanging the test until timeout. Always initialize test apps with `initTestApplication(app)` from `#/__tests__/test-app.provider`, which awaits both `app.init()` and the Fastify instance's `.ready()`:

  ```typescript
  app = await new TestAppProvider().provide(moduleFixture);
  await initTestApplication(app);
  ```

See [docs/agents/testing.md](docs/agents/testing.md) for test conventions, builders, and fixture patterns.

## Pre-Commit Checklist

Before creating **EACH** commit, you MUST run the following commands in sequence and fix any issues:

1. **Format the code:**

   ```bash
   yarn format
   ```

2. **Run linter and fix issues:**

   ```bash
   yarn lint --fix
   ```

   If there are any remaining lint errors, fix them manually before proceeding.

3. **Type-check (specs included):**

   ```bash
   yarn typecheck
   ```

4. **Run tests:**

   ```bash
   yarn test
   ```

   All tests must pass before committing. If tests fail, fix the issues before proceeding.

## Commit Workflow

The correct workflow for making commits is:

```bash
# 1. Make your code changes
# 2. Run quality checks
yarn format
yarn lint --fix
yarn typecheck
yarn test

# 3. Only after all checks pass, commit
git add <files>
git commit -m "Your commit message"
```

## Pre-PR Architecture Review

Before **EACH** push, and so before opening any PR, every agent MUST apply [docs/agents/reviewing.md](docs/agents/reviewing.md) to the full branch diff (`git diff origin/main...HEAD`), not only the last commit. This is the same review the `@claude arch-review` CI check runs. Under Claude Code, load the `cgw-review` skill for it.

1. **Findings:** fix every finding you can resolve from the code and the cited guide, commit the fixes, and review the new `HEAD` again.
2. **A finding needs a human decision:** stop and ask the user. Do not push.
3. **No findings, or the user explicitly accepts the remaining ones:** record the reviewed commit, then push:

   ```bash
   git rev-parse HEAD > "$(git rev-parse --git-common-dir)/arch-reviewed"
   ```

   Never record a commit you have not reviewed, and never treat findings as accepted without the user's explicit word.

Every push is gated on that marker, whichever agent runs it: `.husky/pre-push` rejects a pushed branch whose tip does not match it. Agents with hook support also stop before the push runs: under Claude Code, a `PreToolUse` hook blocks `git push` and hands the agent this loop. Details: [docs/agents/agent-tooling.md](docs/agents/agent-tooling.md#the-pre-push-gate).

## License Headers

All source files changed after Feb 16th 2026 **must** include an SPDX license header at the very top of the file. The header format depends on the file type:

| File type                            | Comment style | Header                                    |
| ------------------------------------ | ------------- | ----------------------------------------- |
| `.ts`, `.tsx`, `.js`, `.mjs`         | `//`          | `// SPDX-License-Identifier: FSL-1.1-MIT` |
| `.yaml`, `.yml`, `.sh`, `Dockerfile` | `#`           | `# SPDX-License-Identifier: FSL-1.1-MIT`  |
| `.md`                                | HTML comment  | Multi-line: `<!--\n  SPDX-...\n -->`      |
| `.sql`                               | `--`          | `-- SPDX-License-Identifier: FSL-1.1-MIT` |

For `.md` files the hook uses a multi-line HTML comment style (`<!--| | -->`), so the header spans three lines.

This is enforced by a `pre-commit` hook (`insert-license` from `Lucas-C/pre-commit-hooks`) and a `license-headers` CI job. The canonical header text lives in `LICENSE_HEADER.txt`.

Every file you create or modify in a PR **MUST** have the correct license header. Add it yourself — do not rely on the pre-commit hook to do it for you. If the pre-commit hook adds it automatically, include that change in your commit.

## Important Notes

- **Never skip these steps** - even for "minor" changes
- **Never commit** if any of these commands fail
- If tests fail, investigate and fix the root cause
- If lint errors persist after `--fix`, manually resolve them
- These checks help maintain code quality and prevent breaking changes
