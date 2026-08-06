<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Testing

This guide states the testing conventions for Safe Client Gateway: which test type to write, how to run each locally and in CI, the Vitest project layout tests run under, and the rules that keep test data and mocking consistent. The shared `Builder`/`IBuilder` helper and the three-Vitest-project split are introduced in `docs/agents/ARCHITECTURE.md`'s Module anatomy section; this guide is their normative, in-depth treatment.

## Test types

- **Unit (`*.spec.ts`)** — every dependency the file under test touches is mocked: no real database, cache, queue, or upstream HTTP call. Use it for services, controllers, repositories, schemas, and validators — the default choice, and the fastest to run.
- **Integration (`*.integration.spec.ts`)** — runs against a real Postgres database (via TypeORM) and real Redis/BullMQ, and boots the actual NestJS module graph. Use it for a repository's queries, a migration, a queue consumer, or a controller flow that has to prove out a real module boundary rather than a mocked one.
- **E2E (`*.e2e-spec.ts`)** — boots the whole application the way production does, for a full request/response cycle across every layer. 18 exist today, one per feature needing a full-app smoke test — e.g. `src/app.module.e2e-spec.ts`, `src/modules/spaces/routes/spaces.controller.e2e-spec.ts`, `src/modules/data-decoder/routes/__tests__/data-decode.e2e-spec.ts`.

Write the fastest test that still proves the point:

- Reach for **unit** when the code under test is business logic, a data transformation, a validator/schema, or a controller whose only injected dependencies are mocked services.
- Reach for **integration** once mocking a dependency would stop testing the boundary that actually matters — a repository's queries, a migration, a queue consumer, or a request/response cycle spanning multiple modules.
- Reach for **e2e** only for a workflow critical enough to warrant a full-app smoke test end to end.

Today's split: 336 unit specs, 80 integration specs, 18 e2e specs.

## Running tests locally

Commands, all defined in `package.json` and all resolving `vitest.config.ts`'s named projects:

- `yarn test` / `yarn test:unit` — the `unit` project; these two are equivalent.
- `yarn test:integration` — the `integration` project.
- `yarn test:all` / `yarn test:all:cov` — `vitest run` with no `--project` filter, i.e. every project `vitest.config.ts` defines (unit, integration, and e2e) in one pass.
- `yarn test:watch` — the `unit` project, in watch mode.
- `yarn test:unit:cov` / `yarn test:integration:cov` — the matching project, instrumented with `@vitest/coverage-v8`, written to `./coverage`.
- `yarn test:debug [path/to/file.spec.ts]` — the `unit` project under `--inspect-brk` with `--no-file-parallelism`, for stepping through a single file in a debugger.
- `yarn test --reporter=verbose` — the `unit` project with per-test output instead of the default reporter.
- `yarn test:e2e` / `yarn test:e2e:cov` — the `e2e` project; exists as a script, but nothing in CI runs it (see below).

In GitHub Actions (`.github/workflows/ci.yml`), `unit-tests` and `integration-tests` run as separate parallel jobs, each reporting to Coveralls, with a `tests` job gating branch protection on both. Both jobs provision Postgres, Redis, and RabbitMQ as GitHub Actions `services:` — including `unit-tests`, even though every unit spec mocks its own I/O and never reaches them; `integration-tests` is the job that actually needs the services, running real migrations against the job's Postgres service (database `test-db`) after a full `yarn build` (a plain `generate-abis` is enough for `unit-tests`, since Vitest transforms straight from `src`). Neither job runs the `e2e` project — nothing in `ci.yml` references `*.e2e-spec.ts` today.

Running integration tests locally needs the same backing services running through Docker Compose — the Postgres service they connect to is named `db-test` (matching the `POSTGRES_TEST_*` variables below), not `postgres`:

```bash
docker compose up -d db-test redis rabbitmq
```

`.env.test` is loaded automatically by every `yarn test:*` script (`node --env-file-if-exists=./.env.test`) and already sets `POSTGRES_TEST_DB`/`POSTGRES_TEST_USER`/`POSTGRES_TEST_PASSWORD`/`POSTGRES_TEST_PORT`, `REDIS_HOST`/`REDIS_PORT`, and `AMQP_URL` to match the Compose services above — override one only if your local setup diverges from it. Then:

```bash
yarn test:integration
```

Either coverage command's output already includes a browsable report at `coverage/index.html`, alongside the raw lcov data Coveralls consumes in CI.

## Vitest project layout

All test configuration lives in one root `vitest.config.ts`, defining three [projects](https://vitest.dev/guide/projects):

- **`unit`** (default) — `src/**/*.spec.ts` and `scripts/**/*.spec.ts`. Runs on the `threads` pool: mocked-I/O specs need no per-file process isolation, and worker threads start far cheaper than the default `forks` pool.
- **`integration`** — `src/**/*.integration.spec.ts`. Default `forks` pool (real DB/Redis/AMQP connections need real process isolation), 60s test timeout.
- **`e2e`** — `src/**/*.e2e-spec.ts`. Default `forks` pool, 40s test timeout.

Every project is transformed through SWC (`unplugin-swc`, `decoratorMetadata: true`), because NestJS dependency injection relies on `emitDecoratorMetadata`, which Vite's default Oxc transform drops. `integration` and `e2e` share `test/e2e-setup.ts` (production-shaped env defaults for a full app boot) plus `test/faker-setup.ts`; `unit` loads only the latter. All three projects pin `env: { TZ: 'UTC' }` and set `clearMocks: true`.

Coverage is configured once, at the root, and aggregates across all three projects: `@vitest/coverage-v8` writes lcov/html/text to `./coverage`, over `src/**/*.{ts,js}` minus `index.ts` barrel files, `.builder.ts`/`.factory.ts` test helpers, and `.integration.spec.ts`/`.e2e-spec.ts` files themselves — test infrastructure and slower suites aren't what the coverage number is meant to measure.

`faker-setup.ts` seeds `@faker-js/faker` once per test file — from `FAKER_SEED` if set, otherwise a random seed it logs as `[faker] seed=<n>` — so a failing run's data is reproducible by re-running with `FAKER_SEED=<n>`.

Globals (`describe`/`it`/`expect`/`vi`) are enabled for every project, so they need no import; the Vitest type helpers (`MockedObject`, `MockInstance`) still do, imported from `'vitest'` directly. Every project also resolves `{ tsconfigPaths: true }`, so a spec's `@/*`/`@/abis/*` imports follow the same aliases `tsconfig.json` defines for production code — the `@/` import rule in `docs/agents/module-structure.md` applies unchanged inside a spec.

### Builders and faker only

**Rule:** Test data comes from a fluent builder — `Builder<T>`/`IBuilder<T>` (`src/__tests__/builder.ts`), exposing `.with(key, value)` and `.build()` — populated with `@faker-js/faker` values, never a hand-written literal fixture object; the one exception is an enum/taxonomy value or an explicit assertion boundary, which stays literal because that value is what the test is actually about. A domain entity with no builder yet gets one added at `domain/entities/__tests__/<entity>.builder.ts`. An existing builder is never cloned wholesale for a similar shape — its shared fields move into a helper, or a nested builder, that the new one also calls.

**Why:** a literal fixture makes every field look equally load-bearing whether the test depends on it or not; a faker-backed builder makes the unexercised fields visibly arbitrary, so a reviewer can tell which values an assertion actually pins.

**Canonical example:** `src/modules/chains/domain/entities/__tests__/chain.builder.ts`'s `chainBuilder()` builds a full `Chain` through `Builder<Chain>().with(...)`, itself composing 11 sibling builders from the same directory (`rpcUriBuilder`, `nativeCurrencyBuilder`, `themeBuilder`, and others) rather than inlining their shapes — one of 169 `.builder.ts` files in the codebase today.

A `*.factory.ts` file is not this pattern and is not a template to copy for a new entity's test data — it's a rare, integration-only exception for standing up real infrastructure. `TestDbFactory` (`src/__tests__/db.factory.ts`) is the canonical one: it opens an admin Postgres connection and creates/drops an ephemeral, per-suite database, which is infrastructure setup, not a domain fixture.

### Mocking idiom

**Rule:** A mock is a plain object literal of `vi.fn()`s cast `as MockedObject<T>`; when the literal only covers part of the interface, double-cast through `as unknown as MockedObject<T>` instead of widening the literal itself. A manual `vi.clearAllMocks()` in `beforeEach` is never added — `clearMocks` is already set globally in `vitest.config.ts`.

**Why:** `clearMocks: true` already resets every `vi.fn()`'s call history between tests for the whole run; a spec-level reset on top of it is redundant at best, and since one spec file can't opt the rest of the suite out of the global setting, it never actually fills a gap the config leaves open.

**Canonical example:** `vitest.config.ts` sets `clearMocks: true` in each of its three project configs. `src/modules/portfolio/v1/portfolio.controller.spec.ts` casts `{ getPortfolio: vi.fn(), clearZerionCaches: vi.fn() }` directly `as MockedObject<PortfolioApiService>`; `src/modules/hooks/domain/hooks.repository.spec.ts`'s `mockMessagesRepository` double-casts `{ clearMessages: vi.fn() } as unknown as MockedObject<MessagesRepository>`, since that literal covers only one method of the interface.

### App bootstrapping in tests

**Rule:** An HTTP-level test never calls a bare `await app.init()`; it initializes through `initTestApplication(app)` (`src/__tests__/test-app.provider.ts`) instead, regardless of whether the app itself came from that file's plain `createTestApplication` or from `new TestAppProvider().provide(module)`.

**Why:** Fastify only attaches its route lifecycle hooks once the underlying instance's `.ready()` resolves; a request fired right after a bare `init()` races that boot sequence and can hang inside Fastify's own hook runner until the test times out, instead of failing fast with a clear error.

**Canonical example:** `initTestApplication`'s own doc comment in `src/__tests__/test-app.provider.ts` names this exact hazard — it awaits `app.init()` and then `app.getHttpAdapter().getInstance().ready()`. `src/modules/safe/routes/safes.controller.integration.spec.ts` (and its sibling `overview`/`nonces`/`v2` specs) call `app = await new TestAppProvider().provide(moduleFixture); await initTestApplication(app);` in `beforeAll` — never a bare `app.init()`.

`createTestApplication` (paired with a bare `TestingModule`) is the lightweight form, left at Fastify's defaults for whatever the test doesn't configure itself; `new TestAppProvider().provide(module)` instead runs the same configuration steps production boots through — versioning, body parsers, everything except shutdown hooks — for a test that needs the app shaped like the deployed one. Either way, `initTestApplication` is the step that actually finishes bringing it up.

### Test taxonomy

**Rule:** `*.spec.ts` mocks all I/O; `*.integration.spec.ts` runs against real Postgres, Redis, and RabbitMQ; `*.e2e-spec.ts` boots the whole app, and is not run in CI today (see Running tests locally above — nothing in `ci.yml` references it). A spec is co-located with the code it exercises, never gathered into a parallel test tree; its builders live under a `__tests__/` directory next to the entity they build.

**Why:** the three suffixes are how `vitest.config.ts` routes a file to the right project at all — the `unit` project's `include`/`exclude` globs are exactly what makes it safe to run without Docker. Misnaming a file's suffix silently moves it into the wrong project, or out of every project's `include` glob entirely.

**Canonical example:** `src/modules/chains/`'s `domain/chains.repository.spec.ts` (unit, every dependency mocked) sits next to `routes/chains.controller.integration.spec.ts` (integration, boots a real Nest module through `TestAppProvider`/`initTestApplication` and drives it with `supertest`) and the module's own builders under `domain/entities/__tests__/*.builder.ts` — all three co-located with the code they cover.

`docs/agents/module-structure.md`'s Imports rule records the one known deviation from this placement — a builder importing its entity via a relative path instead of `@/` — which is not precedent to extend either.

### Determinism

**Rule:** Faker is seeded per test file, so a failing run is reproducible by re-running with `FAKER_SEED=<n>` (the seed a run used is always logged). Time is pinned to `TZ=UTC` for every project. A test never depends on another test's side effects or on run order — each one is independent and idempotent on repeat.

**Why:** an unseeded faker value or a local timezone makes a failure irreproducible outside the exact process that hit it; a test that silently depends on another test having already run is the other common source of a suite that passes in isolation and fails in CI, or the reverse.

**Canonical example:** `test/faker-setup.ts` seeds `@faker-js/faker` from `FAKER_SEED` (or a fresh random seed it logs as `[faker] seed=<n>`) before any test in the file runs; `vitest.config.ts` sets `env: { TZ: 'UTC' }` in all three of its projects, and every `yarn test:*` script additionally prefixes the same `TZ=UTC`.

`faker-setup.ts` is a `setupFiles` entry shared by all three projects, so this isn't a unit-only concern: an integration or e2e spec seeding its fixtures through the same builders gets the exact same reproducibility.

### Constructor-change sweep

**Rule:** After changing a repository's constructor parameters, run the standing sweep — `grep -rn "new <RepoClass>(" src --include='*.integration.spec.ts'` — and update every call site it returns before the change is done.

**Why:** the full rationale — `*.integration.spec.ts` hand-constructs repositories with `new` rather than through Nest DI, and `tsconfig.build.json` excludes spec files from the typecheck that would otherwise catch this — belongs to `docs/agents/database-and-migrations.md`'s "The integration-spec constructor sweep" rule; this entry only cross-references it so a testing-focused pass over this guide doesn't miss the sweep.

**Canonical example:** see the `WalletsRepository` sweep worked through in `docs/agents/database-and-migrations.md`'s "The integration-spec constructor sweep" rule.
