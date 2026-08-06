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
| Adding a skill or a slash command for this repo | [docs/agents/agent-tooling.md](docs/agents/agent-tooling.md) |

Each guide is also delivered as a `cgw-*` Claude Code skill that auto-loads on the matching work, and the recurring workflows have slash commands (`/new-route`, `/new-datasource`, `/new-domain-service`, `/new-env-var`, `/new-migration`, `/audit-test`, `/pr-ready`). Both are indexed in [docs/agents/agent-tooling.md](docs/agents/agent-tooling.md).

## Non-negotiables

1. Every `@Param`/`@Query`/`@Body` goes through `new ValidationPipe(ZodSchema)` — no bare access. → [security.md](docs/agents/security.md)
2. Never call `fetch`/HTTP clients directly — outbound calls go through `INetworkService`/`CacheFirstDataSource`. → [caching-and-performance.md](docs/agents/caching-and-performance.md)
3. Datasources return `Raw<T>`; the owning repository must `Schema.parse()` before returning. → [api-dtos-and-validation.md](docs/agents/api-dtos-and-validation.md)
4. Imports use the `@/` alias only; import other modules only via their `domain/`. → [module-structure.md](docs/agents/module-structure.md)
5. New feature code goes in `src/modules/<kebab>/` following the canonical skeleton — never in `src/routes/`, `src/domain/`, or `src/datasources/`. → [module-structure.md](docs/agents/module-structure.md)
6. Test data comes from builders + faker — no literal fixtures. → [testing.md](docs/agents/testing.md)
7. Every env var is declared in `configuration.ts` AND `RootConfigurationSchema`; secrets never get fallback defaults. → [configuration-and-flags.md](docs/agents/configuration-and-flags.md)
8. Cache keys only via `CacheRouter`; TTLs only from config. → [caching-and-performance.md](docs/agents/caching-and-performance.md)
9. State-changing or caller-scoped routes declare an auth guard; identity comes from signature recovery or a verified JWT, never from client claims. → [security.md](docs/agents/security.md)
10. One error funnel per layer: `HttpErrorFactory`/`DataSourceError` in datasources; domain errors + filters in `domain/`; `HttpExceptionNoLog` for expected rejections. → [api-dtos-and-validation.md](docs/agents/api-dtos-and-validation.md)

## Architecture

```
Controller → Route Service → Repository → Datasource → CacheFirstDataSource
```

Route services (`routes/*.service.ts`) call repositories (`domain/*.repository.ts`) — never datasources directly — and only a repository calls `Schema.parse()` on a datasource's raw output before trusting it as a domain entity. A new external API client belongs in that module's own `datasources/` (e.g. `src/modules/balances/datasources/coingecko-api.service.ts`); central `src/datasources/` is cross-cutting infrastructure only (cache, db, network, jwt, kms, job-queue, storage, circuit-breaker) plus a handful of legacy API clients not yet migrated — it is not the default home for a new implementation.

See [docs/agents/ARCHITECTURE.md](docs/agents/ARCHITECTURE.md) for the full request lifecycle, validation boundaries, and error funnels.

## Testing

- **Never call bare `await app.init()` in tests.** The HTTP platform is Fastify: route contexts only get their lifecycle hooks attached once Fastify's `.ready()` resolves, so a supertest request sent after `init()` alone races app boot and crashes inside Fastify's hook runner (`Cannot read properties of undefined (reading 'length')`), hanging the test until timeout. Always initialize test apps with `initTestApplication(app)` from `@/__tests__/test-app.provider`, which awaits both `app.init()` and the Fastify instance's `.ready()`:

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

3. **Run tests:**

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
yarn test

# 3. Only after all checks pass, commit
git add <files>
git commit -m "Your commit message"
```

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
