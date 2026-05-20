<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Testing conventions

The organized path through the testing rules. Read top-to-bottom when you're about to write a new test; deep-link into a section when you need to settle a specific question. Each section names the one canonical answer and lists the alternatives that are explicitly banned, with reasons.

Three layers exist in this repo: **unit** (`*.spec.ts`), **integration** (`*.integration.spec.ts`), **e2e** (`*.e2e-spec.ts`). The cross-cutting rule above everything else: **push every property to the lowest layer that can prove it.** Wiring is proved once per route at e2e; per-branch coverage lives at unit. Re-testing branches through higher layers multiplies maintenance cost and proves nothing the unit didn't already prove. (`TEST-02`)

Every section ends with cross-references: `Rule:` points at the entry in [`rules.json`](../sources/rules.json); `Examples:` points at the PR-sourced receipts in [`examples/testing.md`](../sources/examples/testing.md).

## Contents

1. [Pick the layer](#1-pick-the-layer)
2. [File placement and name](#2-file-placement-and-name)
3. [Unit tests](#3-unit-tests)
   1. [Test instance construction](#31-test-instance-construction)
   2. [Mocks](#32-mocks)
   3. [Builders for entity fixtures](#33-builders-for-entity-fixtures)
   4. [Global state and teardown](#34-global-state-and-teardown)
   5. [`it()` blocks and naming](#35-it-blocks-and-naming)
   6. [Assertions](#36-assertions)
4. [Integration tests](#4-integration-tests)
   1. [Per-spec database](#41-per-spec-database)
   2. [What to mock; what to boot](#42-what-to-mock-what-to-boot)
   3. [What does not belong here](#43-what-does-not-belong-here)
5. [E2E tests](#5-e2e-tests)
   1. [App + JWT setup](#51-app--jwt-setup)
   2. [What belongs here — wiring, not branches](#52-what-belongs-here--wiring-not-branches)
   3. [What does not belong here](#53-what-does-not-belong-here)
6. [Cross-cutting](#6-cross-cutting)
   1. [Builders](#61-builders)
   2. [Test descriptions](#62-test-descriptions)
   3. [Fixtures fail loudly](#63-fixtures-fail-loudly)
7. [Running and trimming](#7-running-and-trimming)

---

## 1. Pick the layer

Decision rule: *Can I prove this property without starting the app, the database, the network, or the framework?*

- **Yes** → unit (`*.spec.ts`).
- **Only DB or Nest module bootstrap is needed** → integration (`*.integration.spec.ts`).
- **HTTP + global filters/validation must be exercised** → e2e (`*.e2e-spec.ts`).

| Property under test | Layer | File suffix |
|---|---|---|
| Schema / zod / pure mapping | unit | `<name>.schema.spec.ts`, `<dto>.entity.spec.ts` |
| Service branches (auth, error mapping, `affected=0`, conditional pathways) | unit | `<name>.service.spec.ts` |
| Repository methods that do **not** touch DB (pure SQL string shaping) | unit | `<name>.repository.spec.ts` |
| Repository methods that touch DB | integration | `<name>.repository.integration.spec.ts` |
| Datasource bootstrap, migrations, Redis/RabbitMQ/Postgres wiring | integration | `<name>.module.integration.spec.ts` |
| Route registration + global filter mapping (`NotFoundException → 404`, `ZodError → 422`, `ForbiddenException → 403`) | e2e | `<name>.controller.e2e-spec.ts` |
| Full HTTP flow (auth + controller + service + repo + DB) — one representative path per route | e2e | `<name>.controller.e2e-spec.ts` |

### Don't test wiring at the wrong layer

If you've proved a branch at unit, **do not** re-prove it at integration or e2e. Integration tests prove wiring (one route reaches its repo, the queue connects, the migration applies cleanly). E2e tests prove wiring at the HTTP boundary (one representative happy path per route + one representative error-mapping smoke per route). Higher layers do not re-cover service branches.

Rejected:

- *"The sibling files are all `.spec.ts`, so I'll follow them."* — The suffix encodes the test layer, not the neighbourhood. If neighbours are mis-suffixed, that's a separate cleanup. (`RL-20260506-001`)
- *"Test the controller because it's the entry point."* — Service branches are already proven at unit; re-testing through the controller multiplies maintenance and proves nothing new.
- *"Add this new negative path to the e2e suite for safety."* — Negative paths live at the layer that owns the branch. The e2e suite asserts the route returns 404 once; the unit asserts every `affected=0` and missing-membership case.
- *"Boot Nest in this unit spec just to be safe."* — Hides the dependency the test should expose and turns a sub-second spec into multi-second.

Rule: [`TEST-02` Right test layer (pyramid)](../sources/rules.json) · Examples: [`testing.md#TEST-02`](../sources/examples/testing.md)

---

## 2. File placement and name

Colocate the spec next to the source file: `src/modules/foo/foo.service.ts` → `src/modules/foo/foo.service.spec.ts`. The suffix encodes the layer:

| Suffix | Layer |
|---|---|
| `*.spec.ts` | unit |
| `*.integration.spec.ts` | integration |
| `*.e2e-spec.ts` | e2e |

`src/__tests__/` is reserved for shared resources (test app bootstrap, global fixtures), not per-unit specs.

Rejected:

- `src/__tests__/foo.service.spec.ts` for a per-unit test — wrong directory.
- `foo.service.test.ts` — the project uses `.spec.ts`, not `.test.ts`.
- `foo.service.unit.spec.ts` — `.spec.ts` already means unit. Only `.integration.spec.ts` and `.e2e-spec.ts` add meaning.
- `foo.controller.v1.spec.ts` to mirror controller version suffixes — version the controller file, not the spec suffix.

Rule: [`TEST-02`](../sources/rules.json) · Examples: [`testing.md#TEST-02`](../sources/examples/testing.md)

---

## 3. Unit tests

### 3.1 Test instance construction

Use `new`. Construct the class under test directly, in the `describe`-scope:

```ts
const service = new FooService(
  mockBarRepository,
  mockBazService,
  mockLoggingService,
);
```

Rejected:

- `Test.createTestingModule({ providers: [FooService, { provide: IBar, useValue: mockBar }] }).compile()` — booting Nest's DI for a single class is dead weight and hides the constructor signature you're trying to exercise. (`TEST-01`)
- Wrapping construction in a `setupService()` factory used by every `describe` — let the constructor call live at `describe`-scope; readers should see exactly what is injected.

Rule: [`TEST-01` Use builders and fakes](../sources/rules.json) · Examples: [`testing.md#TEST-01`](../sources/examples/testing.md)

### 3.2 Mocks

For each dependency interface `IBar` the unit takes:

```ts
const mockBar = {
  method1: jest.fn(),
  method2: jest.fn(),
} as jest.MockedObjectDeep<IBar>;
```

Rules:

- Only declare the methods the unit under test actually calls. If production code starts calling a new method, the test should fail noisily — that's the test doing its job.
- Use `jest.MockedObjectDeep<T>` for the cast. It preserves the surface type so `mockBar.method1.mockResolvedValue(...)` stays typed.
- For `ICacheService`, instantiate the real fake: `new FakeCacheService()`. The fake is the project's source of truth for cache semantics — don't mock the interface.
- For `ILoggingService`, the standard no-op shape:
  ```ts
  const mockLoggingService = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as jest.MockedObjectDeep<ILoggingService>;
  ```

Rejected:

- `jest.mock('@/modules/bar/bar.service')` for an internal collaborator — module mocking is reserved for code at the project boundary (HTTP clients, fs, third-party SDKs). Internal collaborators come in through the constructor. (`TEST-01`)
- `jest.spyOn(service, 'somePrivateHelper')` to override an internal method — if you need to fake an internal helper, that's the signal to extract it as a dependency, not to spy. Spying couples the spec to the implementation. (`TEST-03`)
- `jest.fn() as any` to satisfy a type — defeats the type check. Use `jest.MockedObjectDeep<T>`; if it still won't fit, the type is wrong, not the cast.
- Mocking a TypeORM `QueryBuilder` chain (`mockQuery.where(...).select(...).getMany()`) — couples the test to ORM internals. (`TEST-03`) If you find yourself doing this, you're at the wrong layer: this property belongs in an integration spec against a real DB.
- `jest.mock('@/totally-unused-thing')` — leftover mocks rot; only mock what's used. (`TEST-01`)
- `as Partial<IBar>` for a mock — `Partial` makes every method optional, including ones the unit relies on. Use `MockedObjectDeep` plus the explicit method list.

Rule: [`TEST-01`](../sources/rules.json), [`TEST-03` No internal mock chains](../sources/rules.json)

### 3.3 Builders for entity fixtures

Use the `Builder<T>` pattern. The builder lives next to the entity it builds: `src/modules/<module>/entities/__tests__/<entity>.builder.ts`.

```ts
const member = memberBuilder()
  .with('role', 'ADMIN')
  .with('status', 'ACTIVE')
  .build();
```

Each `it()` calls `.build()` afresh — never share a mutable fixture across tests. If the builder doesn't exist for your entity, create it now (typically under 20 lines). The builder owns the entity's invariants and is the single point that updates when fields are added.

Rejected:

- Inline object literals copy-pasted across tests:
  ```ts
  const entity = {
    fallbackHandler: getAddress(faker.finance.ethereumAddress()),
    guard: getAddress(faker.finance.ethereumAddress()),
    moduleGuard: getAddress(faker.finance.ethereumAddress()),
    enabledModules: [getAddress(faker.finance.ethereumAddress())],
  };
  ```
  When the entity grows a required field, you'll update one literal and silently weaken the others. (`RL-20260506-002`)
- One shared `const member = memberBuilder().build()` at file scope mutated inside tests. Build fresh per `it()`, override with `.with(...)`.
- `as Partial<MemberDto>` plus a few fields — same trap as `Partial` mocks: missing required fields slip through.

Rule: [`TEST-01`](../sources/rules.json) · Examples: [`testing.md#TEST-01`](../sources/examples/testing.md)

### 3.4 Global state and teardown

If the test mutates anything outside its own stack frame — `process.env`, `Date`, `Math.random`, a singleton, fake timers — snapshot once at file scope and restore in `afterEach`:

```ts
let originalNodeEnv: string | undefined;

beforeAll(() => {
  originalNodeEnv = process.env.NODE_ENV;
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  jest.resetAllMocks();
});
```

`jest.resetAllMocks()` in `afterEach` clears call records *and* `mockResolvedValue` defaults — set defaults again in `beforeEach` if you need them.

Rejected:

- Setting `process.env.X = 'y'` in `beforeEach` without an `afterEach` restore — leaks `X` into later test files. Order-dependent failures ("pass alone, fail in suite") trace back here. (`RL-20251219-002`)
- `jest.useFakeTimers()` without a matching `jest.useRealTimers()` in teardown.
- `jest.clearAllMocks()` when you needed `jest.resetAllMocks()` — `clear` only wipes call history; `reset` also drops fake implementations.

Rule: [`TEST-05` Scoped test cleanup](../sources/rules.json) · Examples: [`testing.md#TEST-05`](../sources/examples/testing.md)

### 3.5 `it()` blocks and naming

One assertion focus per `it()`. The description names the **property the assertion proves**, not the scenario that led to it:

```ts
it('returns false when there is no source swap', () => { … })
it('returns 403 when caller is not an admin', () => { … })
it('returns undefined when the address fails isAddress', () => { … })
```

For security-sensitive paths (authorization, address validation, sanitization, parsers handling untrusted input), write one `it()` per "input shape that an attacker or buggy caller can supply".

Rejected:

- `it('handles bridging to a different chain', …)` — describes the scenario, not the assertion. (`TEST-08`)
- `it('works', …)` / `it('renders without crashing', …)` — passes even when the branch under test is deleted. (`TEST-08`)
- One mega-`it()` with five `expect()` calls for five unrelated assertions — when one fails the others never run.
- `expect(success).toBe(true); if (success) { expect(success.x).toBe(42) }` — the `if` swallows the failure when `success` is false and the inner expectations silently never run. Assert directly: `expect(result).toEqual({ x: 42 })`. (`TEST-08`)

Rule: [`TEST-04` Cover security paths](../sources/rules.json), [`TEST-08` Test names match assertions](../sources/rules.json), [`TEST-09` Cover edges and determinism](../sources/rules.json) · Examples: [`testing.md#TEST-09`](../sources/examples/testing.md)

### 3.6 Assertions

Prefer asserting return value or thrown error:

```ts
expect(await service.getMember(spaceId, userId)).toEqual(expectedMember);
await expect(service.getMember(spaceId, userId)).rejects.toThrow(NotFoundException);
```

Use `expect(mockBar.method).toHaveBeenCalledWith(...)` only when one of these is true:

1. The dependency call **is** the observable outcome (e.g. `emitter.emit(event, payload)` is what the unit *does*).
2. You need to prove an input was forwarded in a specific shape (e.g. wallet address lowercased before the query).

Don't assert call ORDER on mocks unless ordering is part of the contract.

Rejected:

- `expect(mockRepo.findOne).toHaveBeenCalled()` as the only assertion — proves nothing about correctness; assert the return value.
- Snapshot tests for service output (`toMatchSnapshot()`) unless the unit is a stable pure mapping with no env / time / id-generation in its output.

---

## 4. Integration tests

Integration tests prove the things a unit test cannot: real DB queries return what the SQL says they do, Nest module bootstrap wires the right providers, migrations apply on a real schema. They are the slowest layer that still belongs in CI per branch — keep them focused.

### 4.1 Per-spec database

Each integration spec runs against its own fresh Postgres database, named with `faker.string.alpha`. `PostgresDatabaseService` runs migrations into that database; the spec uses two repository handles:

- The repository **under test** (the thing you wrote).
- Raw `dataSource.getRepository(<Entity>)` handles for arrange/assert setup that bypasses your code.

```ts
const testDatabaseName = faker.string.alpha({ length: 10, casing: 'lower' });
const dataSource = new DataSource({ …postgresConfig({ …, database: testDatabaseName }), entities: [Member, Space, …] });
```

Rejected:

- Sharing one database across specs — order-dependent test failures, slow debugging, hidden coupling.
- Asserting through the repository under test (calling `addressBookItemsRepository.findAll` to prove `addressBookItemsRepository.insert` worked). Use a raw `dataSource.getRepository(...)` for assertions so the test fails when *either* method breaks, not just when both break together.
- `beforeAll` migrations against a long-lived database — the spec stops being reproducible the moment a prior migration changes.

Rule: [`TEST-02`](../sources/rules.json)

### 4.2 What to mock; what to boot

Boot the real:

- Database (Postgres + migrations + entities).
- The repository / datasource under test.
- Direct DB collaborators of the unit under test (other repositories the code reads).

Mock the:

- `IConfigurationService` (boot config from `configuration()` test factory, but mock the service that vends it so individual tests can override per-key).
- `ILoggingService` (same no-op shape as unit specs).

```ts
const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);
```

Use `Builder<T>` for entity fixtures the same way you do in unit specs.

Rejected:

- Mocking a sibling repository "to keep the test simple" — that turns an integration spec into a unit-with-extra-bootstrap. If a sibling repo's behaviour matters, exercise it for real; if it doesn't, push the test down to unit.
- Booting the whole Nest application graph (`TestingModule` + `AppModule`) for a repository test — you don't need the controllers, guards, or filter chain. Use the DataSource + `PostgresDatabaseService` directly.

Rule: [`TEST-01`](../sources/rules.json), [`TEST-02`](../sources/rules.json)

### 4.3 What does not belong here

- **Service branches that don't need the DB to prove** — push to unit.
- **Filter mapping and validation pipe behaviour** — push to e2e (those need the HTTP boundary).
- **Multi-controller "user story" tests** — e2e narratives go in e2e specs; integration owns a single repo or module.
- **Performance / load** — out of scope; the integration suite runs per branch.

Rule: [`TEST-02`](../sources/rules.json)

---

## 5. E2E tests

E2E tests prove the wiring at the HTTP boundary: route registration, global exception filters, validation pipes, auth guards, and the one representative happy-path per route. They are the most expensive layer; one per route — not per branch.

### 5.1 App + JWT setup

`TestAppProvider` + `createTestModule` + `INestApplication` + `supertest`. Sign JWTs with `IJwtService` (resolved out of the test module) so the auth guard accepts requests.

```ts
const moduleFixture = await createTestModule({ config: testConfiguration, … });
jwtService = moduleFixture.get<IJwtService>(IJwtService);
app = await new TestAppProvider().provide(moduleFixture);
await app.init();
```

Override Postgres modules via `overridePostgresV2: false` when the spec needs the real schema. Override notification (and similar side-effecting) repository modules with their `Test*` counterparts so the spec doesn't fan out to real downstream services.

### 5.2 What belongs here — wiring, not branches

- Route is registered at the expected path + method.
- Global `NotFoundException → 404`, `ForbiddenException → 403`, `ZodError / class-validator → 422` mappings.
- Auth guard rejects unauthenticated requests with `401`.
- `ValidationPipe` rejects malformed bodies with `422` (one representative case per route).
- One representative happy path per route — the end-to-end path returns the expected DTO shape and status code.
- One representative error mapping smoke per route — one 4xx flavour is enough.

### 5.3 What does not belong here

- Re-testing every service branch through HTTP — those live at unit.
- Coverage of every validation rule — those live in schema unit specs.
- Repository-method coverage — that lives in integration.
- Performance / load.

Rejected:

- `it('returns 403 when the member is INVITED', …)` plus `it('returns 403 when the member is DECLINED', …)` plus `it('returns 403 when the user is null', …)` in an e2e spec — three branches; pick one representative 403 case for the e2e suite and prove the rest at unit.
- Setting up multiple chained HTTP requests to mimic a user journey ("invite → accept → list → leave") — out of scope; integration/unit own the building blocks, and e2e owns one round-trip per route.

Rule: [`TEST-02`](../sources/rules.json) · Examples: [`testing.md#TEST-02`](../sources/examples/testing.md)

---

## 6. Cross-cutting

### 6.1 Builders

Builders are layer-agnostic. The same `<entity>.builder.ts` is used by unit, integration, and e2e specs. They live at `src/<area>/entities/__tests__/<entity>.builder.ts`. If a builder doesn't exist for an entity you test, create it — it's a 20-line addition that prevents copy-paste drift.

Rule: [`TEST-01`](../sources/rules.json) · Examples: [`testing.md#TEST-01`](../sources/examples/testing.md)

### 6.2 Test descriptions

Across all layers: the `it()` description names the assertion, not the scenario. (Section [3.5](#35-it-blocks-and-naming) covers this in detail.)

Rule: [`TEST-08`](../sources/rules.json)

### 6.3 Fixtures fail loudly

If your spec needs a deployment, an env var, or pre-seeded data, assert that prerequisite at the top of the file and fail with a clear message. Do **not** silently `it.skip(...)`, `xdescribe(...)`, or wrap the body in `if (!process.env.FOO) return`. Silent skips are how dead tests creep in — green forever, regression-blind.

Rule: [`TEST-06` Fixtures fail loudly](../sources/rules.json)

---

## 7. Running and trimming

```bash
yarn test:unit
yarn test:integration
yarn test:e2e

# Filter to a single file
yarn test:unit --testPathPatterns="foo.service.spec"
yarn test:integration --testPathPatterns="foo.repository.integration"
yarn test:e2e --testPathPatterns="foo.controller"
```

Single-file unit run should be well under a second. Integration single-file run can be a few seconds (migrations dominate). If a unit spec takes >1s, you have a hidden integration concern — review sections [1](#1-pick-the-layer) and [3.2](#32-mocks).

After your test passes:

- Remove any mock method you declared in [3.2](#32-mocks) that isn't actually called.
- Remove any builder field override that doesn't influence the assertion.
- Remove any `console.log`.

---

## How this doc gets updated

When a PR review surfaces a new mistake or a confirmed-good pattern:

1. Log it in [`working/review-learnings.json`](../sources/working/review-learnings.json) as today (the existing `RL-YYYYMMDD-NNN` flow).
2. Tag the learning with the section anchor: `"conventionsAnchor": "testing.md#3.2-mocks"`.
3. Either fold it in as a new bullet under the section's **Rejected** list (most common — new alternative to ban), or promote a new subsection if the mistake reveals a missing decision (rare — restructure the flow).
4. If the related rule already exists in [`rules.json`](../sources/rules.json), add the `TEST-NN` reference; if it doesn't, file the new rule first.

Today this is manual. The `code-conventions` skill can later run an agent pass over new review-learnings tagged with `conventionsAnchor` to propose doc diffs for review.
