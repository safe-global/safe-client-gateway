# Engineering Rules

> Generated from `rules.json`. Do not edit by hand; edit `rules.json`, then regenerate this file.

## 📑 Quick Index

| ID | Title | Group |
| --- | --- | --- |
| [`CHANGE-01`](#change-01) | Smallest correct change | general / scope |
| [`CHANGE-02`](#change-02) | No unrelated drive-by edits | general / scope |
| [`CHANGE-03`](#change-03) | Tooling parity preserved | general / scope |
| [`CHANGE-04`](#change-04) | External contracts versioned | general / scope |
| [`PR-01`](#pr-01) | New abstractions justified | general / scope |
| [`PR-02`](#pr-02) | Docs aligned with behavior | general / scope |
| [`MOD-01`](#mod-01) | Behavior in the right module | general / modules |
| [`MOD-02`](#mod-02) | Persistence behind repositories | general / modules |
| [`MOD-03`](#mod-03) | No single-use DI abstractions | general / modules |
| [`MOD-04`](#mod-04) | No private behavior leaks | general / modules |
| [`MOD-05`](#mod-05) | No new forwardRef cycles | general / modules |
| [`MOD-06`](#mod-06) | Route services behind repositories | general / modules |
| [`NAME-01`](#name-01) | Names reveal behavior | general / naming |
| [`REUSE-01`](#reuse-01) | Reuse existing helpers | general / naming |
| [`STYLE-01`](#style-01) | Document non-trivial code | general / naming |
| [`TYPE-01`](#type-01) | Use project types | general / types |
| [`TYPE-02`](#type-02) | Schemas in entity files | general / types |
| [`TYPE-03`](#type-03) | Validate external inputs | general / types |
| [`TYPE-04`](#type-04) | DTO matches wire shape | general / types |
| [`TYPE-05`](#type-05) | Parser generics complete | general / types |
| [`TYPE-06`](#type-06) | No unsafe casts | general / types |
| [`AUTH-01`](#auth-01) | Reuse auth assertions | general / auth |
| [`AUTH-02`](#auth-02) | Identity supports SIWE and email | general / auth |
| [`AUTH-03`](#auth-03) | Use proven auth/crypto libs | general / auth |
| [`AUTH-04`](#auth-04) | Email exposure intentional | general / auth |
| [`AUTH-05`](#auth-05) | Space routes enforce membership before data access | general / auth |
| [`ROUTE-01`](#route-01) | Controllers are HTTP boundary | general / routes |
| [`ROUTE-02`](#route-02) | Inputs validated at controller | general / routes |
| [`ROUTE-03`](#route-03) | Stable empty shapes | general / routes |
| [`DB-01`](#db-01) | Unique constraint matches lifecycle | general / database |
| [`DB-02`](#db-02) | Atomic state transitions | general / database |
| [`DB-03`](#db-03) | No redundant DB trips | general / database |
| [`DB-04`](#db-04) | DB errors mapped at write boundary | general / database |
| [`DB-05`](#db-05) | Migrations agree with code | general / database |
| [`CACHE-01`](#cache-01) | Multi-step cache writes checked | general / cache |
| [`CACHE-02`](#cache-02) | Cache keys cover all inputs | general / cache |
| [`CONFIG-01`](#config-01) | Defaults safe and OSS-generic | general / config |
| [`CONFIG-02`](#config-02) | Config fails fast | general / config |
| [`CONFIG-03`](#config-03) | TTLs are config | general / config |
| [`CONFIG-04`](#config-04) | Pinned runtime versions | general / config |
| [`CONFIG-05`](#config-05) | Env metadata matches runtime | general / config |
| [`PERF-01`](#perf-01) | Batch and parallelize I/O | general / performance |
| [`TEST-01`](#test-01) | Use builders and fakes | general / tests |
| [`TEST-02`](#test-02) | Right test layer (pyramid) | general / tests |
| [`TEST-03`](#test-03) | No internal mock chains | general / tests |
| [`TEST-04`](#test-04) | Cover security paths | general / tests |
| [`TEST-05`](#test-05) | Scoped test cleanup | general / tests |
| [`TEST-06`](#test-06) | Fixtures fail loudly | general / tests |
| [`TEST-07`](#test-07) | Pipeline coverage | general / tests |
| [`TEST-08`](#test-08) | Test names match assertions | general / tests |
| [`TEST-09`](#test-09) | Cover edges and determinism | general / tests |
| [`LOG-01`](#log-01) | Operational log levels | general / logging |
| [`LOG-02`](#log-02) | No noisy success logs | general / logging |
| [`LOG-03`](#log-03) | Telemetry cost-justified | general / logging |
| [`LOG-04`](#log-04) | Structured logs and asError | general / logging |
| [`SEC-01`](#sec-01) | Validate redirect targets | general / security |
| [`SEC-02`](#sec-02) | Bounded sensitive fields | general / security |
| [`CACHE-03`](#cache-03) | Cached payload shape is canonical once | general / cache |
| [`DATA-01`](#data-01) | Aggregates match returned items and signed values | general / data |
| [`RESILIENCE-01`](#resilience-01) | Resilience policy semantics | resilience |

---

## 🌐 general › scope

<a id="change-01"></a>
### `CHANGE-01` Smallest correct change

> **general** · scope

**📜 Rule**\
A PR should be the smallest correct change for the behavior; avoid surrounding cleanup, helpers, abstractions, or refactors that the change does not require.

**✅ Check**\
> Is this the smallest correct change for the behavior?

---

<a id="change-02"></a>
### `CHANGE-02` No unrelated drive-by edits

> **general** · scope · 1 example · ↩ `RL-20251211-001`

**📜 Rule**\
Keep unrelated docs, config, formatting, or generated changes out of feature PRs.

**✅ Check**\
> Did I avoid unrelated docs/config/formatting/generated changes?

<details>
<summary><strong>💡 Example</strong> — <code>examples/scope-and-pr-hygiene.md</code> § <em>change-02-do-not-bundle-unrelated-test-or-tooling-fixes-into-a-feature-pr</em></summary>

<br>

**CHANGE-02 — Do not bundle unrelated test or tooling fixes into a feature PR**

Source: PR #2845 (RL-20251211-001)

### Avoid

Slipping an unrelated test infrastructure fix (faker seed reset,
race-condition shim, lint sweep) into a feature branch:

```ts
// PR title: feat: add Linea network support
// inside an unrelated controller spec:
beforeEach(async () => {
  // Reset faker seed to ensure consistent values when running all tests
  faker.seed(123);
  // ...rest of the original setup
});
```

### Prefer

Branch the cleanup into its own PR so the review reads only one
concern at a time:

```bash
git switch main
git switch -c chore/reset-faker-seed-in-imitation-spec
# move the seed-reset commit here
gh pr create --title "test: reset faker seed in imitation spec to fix flake"
# the original feature PR rebases without the test-only commit
```

### Why

A reviewer scanning a Linea support PR is not primed to spot subtle
test seed regressions, and a future bisect points at the feature
commit when the regression is actually in the bundled cleanup. Even
a one-line drive-by costs more in review attention than a follow-up
PR costs in process — especially when the cleanup itself deserves a
focused review of why the test was flaky to begin with.

<sub>Source: <a href="examples/scope-and-pr-hygiene.md#change-02-do-not-bundle-unrelated-test-or-tooling-fixes-into-a-feature-pr">examples/scope-and-pr-hygiene.md#change-02-do-not-bundle-unrelated-test-or-tooling-fixes-into-a-feature-pr</a></sub>

</details>

---

<a id="change-03"></a>
### `CHANGE-03` Tooling parity preserved

> **general** · scope · ↩ `RL-20260622-001` · `RL-20260622-002`

**📜 Rule**\
Tooling work (lint, formatter, build, CI, test runner) must preserve previous behavior, rule parity, and docs. In CI, never cache linked `node_modules` — a cache hit skips `yarn install --immutable` and its hardened-mode supply-chain verification; cache the package-manager download cache and install unconditionally. PRs keep a whole-program type check (`tsc --noEmit -p tsconfig.build.json`; ts-jest only checks files tests import), and jobs that read `dist/` (migrations) need the full build.

**✅ Check**\
> If this is tooling work, did I preserve behavior, rule parity, and docs?

---

<a id="change-04"></a>
### `CHANGE-04` External contracts versioned

> **general** · scope · 1 example · ↩ `RL-20260108-001`

**📜 Rule**\
Changes to released external API contracts must be versioned or explicitly backward-compatible; renames of env vars must keep the old name as a fallback for one release.

**✅ Check**\
> If this changes an external contract, is it versioned or explicitly backward-compatible?

<details>
<summary><strong>💡 Example</strong> — <code>examples/configuration.md</code> § <em>change-04-config-05-env-var-rename-keeps-the-old-name-as-a-fallback-for-one-release</em></summary>

<br>

**CHANGE-04 / CONFIG-05 — Env-var rename keeps the old name as a fallback for one release**

Source: PR #2851 (RL-20260108-001)

### Avoid

Renaming an env var in the configuration loader while the PR description
claims backwards compatibility, and updating only `.env.sample` for the
new name:

```ts
// configuration.ts
features: {
  // was: FF_ZERION_BALANCES_CHAIN_IDS
  zerionBalancesEnabled: !!process.env.FF_ZERION_ENABLED,
},
```

Existing deployments still ship with `FF_ZERION_BALANCES_CHAIN_IDS=...`
in their environment and quietly turn the feature off on the next
release.

### Prefer

Read both names for one release; document the new name as authoritative
in `.env.sample`; remove the legacy fallback only in a follow-up PR:

```ts
// configuration.ts
features: {
  zerionBalancesEnabled:
    !!process.env.FF_ZERION_ENABLED ||
    !!process.env.FF_ZERION_BALANCES_CHAIN_IDS, // legacy, remove next release
},
```

`.env.sample` lists the new var with the canonical default; the old
name is mentioned in a comment so operators know what to migrate from.

### Why

Env vars are part of the deployed contract. A rename without a fallback
is a silent feature flip on every consumer that did not redeploy with
the new name. Reading both for one release lets operations migrate
during a normal rollout window, after which the legacy branch can be
deleted with a clean PR that only touches the loader.

<sub>Source: <a href="examples/configuration.md#change-04-config-05-env-var-rename-keeps-the-old-name-as-a-fallback-for-one-release">examples/configuration.md#change-04-config-05-env-var-rename-keeps-the-old-name-as-a-fallback-for-one-release</a></sub>

</details>

---

<a id="pr-01"></a>
### `PR-01` New abstractions justified

> **general** · scope

**📜 Rule**\
New files, providers, interfaces, helpers, factories, injection tokens, or module exports must have a real reuse, boundary, or testability reason.

**✅ Check**\
> Can I justify every new abstraction or file?

---

<a id="pr-02"></a>
### `PR-02` Docs aligned with behavior

> **general** · scope · ↩ `RL-20260128-002` · `RL-20260116-001` · `RL-20260108-002` · `RL-20260108-003`

**📜 Rule**\
Docs, samples, runbooks, and `.env.sample` must reflect the final behavior of the PR.

**✅ Check**\
> Are docs, samples, and runbooks aligned with the final behavior?

---

## 🌐 general › modules

<a id="mod-01"></a>
### `MOD-01` Behavior in the right module

> **general** · modules · ↩ `RL-20260128-002` · `RL-20260608-002` · `RL-20260608-003`

**📜 Rule**\
New API/product behavior belongs in the matching module shape; do not bolt routes onto unrelated modules; do not bypass an existing feature flag by importing a gated module unconditionally. Default-off feature modules stay scoped: not `@Global()`, not registered in the shared test module — override only in the specs that exercise them. Domain services depend on a feature-scoped orchestration service, not on generic infrastructure services (email, queues) directly.

**✅ Check**\
> Does new API/product behavior live in the right module?

---

<a id="mod-02"></a>
### `MOD-02` Persistence behind repositories

> **general** · modules · ↩ `RL-20260529-001` · `RL-20260605-001`

**📜 Rule**\
Services do not know persistence/email uniqueness internals; repositories own DB and external-data adapters. The boundary cuts both ways: repositories do not own business-rule gating — lifecycle checks such as "only INVITED can be renewed" live in the service layer.

**✅ Check**\
> Are persistence workflows hidden behind repositories, and do business-rule/status checks stay in services?

---

<a id="mod-03"></a>
### `MOD-03` No single-use DI abstractions

> **general** · modules

**📜 Rule**\
Do not create an interface, provider, factory, or injection token for a single-use implementation detail unless there is a real boundary, lifecycle, or testability reason; bind config in dynamic modules so the same service can be reused.

**✅ Check**\
> Did I avoid single-use DI abstractions?

---

<a id="mod-04"></a>
### `MOD-04` No private behavior leaks

> **general** · modules · 2 examples · ↩ `RL-20251223-001` · `RL-20251216-002`

**📜 Rule**\
Public interfaces must not expose private helpers; do not add optional methods to shared interfaces — split with `IFooWithBar extends IFoo` instead.

**✅ Check**\
> Did I avoid exposing private helper behavior through public interfaces?

<details>
<summary><strong>💡 Example 1 of 2</strong> — <code>examples/schemas-and-validation.md</code> § <em>mod-04-do-not-export-private-intermediate-schemas</em></summary>

<br>

**MOD-04 — Do not export private intermediate schemas**

Source: PR #2856 (RL-20251223-001)

### Avoid

Exporting every intermediate schema "for consistency" with sibling files:

```ts
// analysis-result.entity.ts — none of these are imported elsewhere
export const FailedAnalysisResultSchema = BaseSchema.extend({ /* ... */ });
export const ModerateAnalysisResultSchema = BaseSchema.extend({ /* ... */ });

export const AnalysisResultSchema = z.discriminatedUnion('type', [
  FailedAnalysisResultSchema,
  ModerateAnalysisResultSchema,
]);
```

### Prefer

Keep intermediate schemas module-local and export only the union or the
type the rest of the codebase consumes:

```ts
const FailedAnalysisResultSchema = BaseSchema.extend({ /* ... */ });
const ModerateAnalysisResultSchema = BaseSchema.extend({ /* ... */ });

export const AnalysisResultSchema = z.discriminatedUnion('type', [
  FailedAnalysisResultSchema,
  ModerateAnalysisResultSchema,
]);
```

### Why

Exported names become part of the module's public surface even when nothing
imports them yet, and tests start asserting on each piece instead of the
contract that ships. If a future consumer or test genuinely needs the
internal schema, promote it then — with the use site as the justification.

<sub>Source: <a href="examples/schemas-and-validation.md#mod-04-do-not-export-private-intermediate-schemas">examples/schemas-and-validation.md#mod-04-do-not-export-private-intermediate-schemas</a></sub>

</details>

<details>
<summary><strong>💡 Example 2 of 2</strong> — <code>examples/schemas-and-validation.md</code> § <em>mod-04-do-not-export-symbols-that-are-not-consumed-externally</em></summary>

<br>

**MOD-04 — Do not export symbols that are not consumed externally**

Source: PR #2850 (RL-20251216-002)

### Avoid

Exporting a constant or helper that no other module imports, on the
theory that it might be useful elsewhere later:

```ts
/**
 * Minimum Safe version that supports CompatibilityFallbackHandler.
 */
export const MIN_FALLBACK_HANDLER_VERSION = '>=1.3.0';
// ...nothing in the codebase imports MIN_FALLBACK_HANDLER_VERSION
```

### Prefer

Keep the symbol module-local; promote to an export when an actual
consumer or test references it:

```ts
const MIN_FALLBACK_HANDLER_VERSION = '>=1.3.0';
// Inline use within the module that owns the constant
```

### Why

Every `export` is a long-lived contract — typegen, IDE auto-import,
and downstream packages all latch on. Exporting "in case someone needs
it" multiplies the public surface without buying a real consumer; if
the next consumer needs a slightly different shape, removing the now-
imported symbol becomes a breaking change.

<sub>Source: <a href="examples/schemas-and-validation.md#mod-04-do-not-export-symbols-that-are-not-consumed-externally">examples/schemas-and-validation.md#mod-04-do-not-export-symbols-that-are-not-consumed-externally</a></sub>

</details>

---

<a id="mod-05"></a>
### `MOD-05` No new forwardRef cycles

> **general** · modules · ↩ `RL-20260529-002`

**📜 Rule**\
Avoid adding or expanding `forwardRef` cycles. Treat existing cycles as local debt; extract a third boundary instead of adding new ones.

**✅ Check**\
> Did I avoid adding or expanding `forwardRef` cycles, including not adding `forwardRef` where no circular dependency exists?

---

<a id="mod-06"></a>
### `MOD-06` Route services behind repositories

> **general** · modules

**📜 Rule**\
Route services orchestrate use cases; they do not call external API datasources directly or own external-data validation/fallbacks. Validate inputs at the controller, not the service.

**✅ Check**\
> Do route services stay behind repository boundaries?

---

## 🌐 general › naming

<a id="name-01"></a>
### `NAME-01` Names reveal behavior

> **general** · naming · 1 example · ↩ `RL-20260506-001` · `RL-20260602-004`

**📜 Rule**\
Names must describe behavior honestly: throwing helpers use `assert*`/`*OrFail`; predicates do not throw; algorithm-bound helpers (`hashSha1`) advertise the algorithm; type/aliased imports drop redundant `as` aliases; magic offsets become named constants. Find-or-create and similar helpers must not encode a status or postcondition the method does not guarantee on every path (`findOrCreateByEmail`, not `findOrCreatePendingByEmail` when existing ACTIVE users are returned as-is).

**✅ Check**\
> Do names describe behavior honestly and avoid redundant scope?

<details>
<summary><strong>💡 Example</strong> — <code>examples/testing.md</code> § <em>test-02-suffix-matches-the-test-layer</em></summary>

<br>

**TEST-02 — Suffix matches the test layer**

Source: PR #2886, #2884 (RL-20260506-001) — also relevant to NAME-01

### Avoid

Picking the suffix to match sibling files:

```text
src/modules/owners/routes/
├── owners.controller.v1.spec.ts             // unit
├── owners.controller.v2.spec.ts             // unit
└── owners.controller.v3.integration.spec.ts // boots Nest, hits DB
```

…or the inverse, naming a Nest-bootstrapped suite `*.spec.ts` because the
neighbours do.

### Prefer

Pick the suffix from what the test actually does:

- `*.spec.ts` — unit, no Nest bootstrap, no DB / Redis / queue.
- `*.integration.spec.ts` — boots Nest modules or hits a real DB.

If the existing siblings have the wrong suffix for the layer they exercise,
that is a separate cleanup, not a reason to keep extending the wrong name.

### Why

Two reviewers in the same week pulled in opposite directions on this PR —
one asked for `.spec.ts` for sibling consistency, the other asked for
`.integration.spec.ts` because the suite booted Nest. The team's answer is
that the suffix encodes the test layer, not the file's neighbours, so unit
runs can stay fast and integration runs stay reproducible.

<sub>Source: <a href="examples/testing.md#test-02-suffix-matches-the-test-layer">examples/testing.md#test-02-suffix-matches-the-test-layer</a></sub>

</details>

---

<a id="reuse-01"></a>
### `REUSE-01` Reuse existing helpers

> **general** · naming · 2 examples · ↩ `RL-20260506-003` · `RL-20251216-001` · `RL-20260615-004`

**📜 Rule**\
Before adding a small util, search the repo and well-known libraries (`viem.isAddressEqual`, `@/logging/utils.asError`, shared schemas, `safe-deployments`); reuse `LoggingService`, `*Mapper` classes, and `HttpErrorFactory` instead of bare alternates.

**✅ Check**\
> Did I reuse existing helpers, constants homes, and utilities?

<details>
<summary><strong>💡 Example 1 of 2</strong> — <code>examples/repositories-and-pagination.md</code> § <em>config-03-reuse-01-knobs-follow-the-existing-config-driven-precedent</em></summary>

<br>

**CONFIG-03 / REUSE-01 — Knobs follow the existing config-driven precedent**

Source: PR #2883 (RL-20260506-003)

### Avoid

Hardcoding a pagination/threshold knob in a new repository when sibling
repositories already read the same kind of value from configuration:

```ts
export class EntityRepository {
  async getAllByOwnerV2(...) {
    // Safety limit to prevent infinite loops
    // todo move to config, similar to chains and contracts repositories?
    const maxSequentialPages = 10;
    // ...
  }
}
```

### Prefer

Inject `IConfigurationService`, follow the precedent (`ChainsRepository`,
`ContractsRepository`) and add the knob to `configuration.ts` plus the
test fixture in the same PR:

```ts
export class EntityRepository {
  private readonly maxSequentialPages: number;

  constructor(
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    /* ... */
  ) {
    this.maxSequentialPages = configurationService.getOrThrow<number>(
      'entity.entitiesByOwner.maxSequentialPages',
    );
  }
}
```

### Why

Hardcoded knobs drift from the rest of the repo as ops needs change —
ChainsRepository can be tuned without a deploy, the new one cannot. The
TODO comment in the diff captures the author's awareness; promote it to a
real config entry now, while the surrounding code is fresh.

<sub>Source: <a href="examples/repositories-and-pagination.md#config-03-reuse-01-knobs-follow-the-existing-config-driven-precedent">examples/repositories-and-pagination.md#config-03-reuse-01-knobs-follow-the-existing-config-driven-precedent</a></sub>

</details>

<details>
<summary><strong>💡 Example 2 of 2</strong> — <code>examples/repositories-and-pagination.md</code> § <em>reuse-01-derive-version-lists-from-safe-deployments</em></summary>

<br>

**REUSE-01 — Derive version lists from safe-deployments**

Source: PR #2850 (RL-20251216-001)

### Avoid

Hardcoding the set of supported Safe contract or fallback-handler
versions in a constant inside the consuming module:

```ts
// Manually enumerated, gets stale with every release
export const FALLBACK_HANDLER_VERSIONS = ['1.3.0', '1.4.1'] as const;

export function getFallbackHandlerVersions(): Array<string> {
  return [...FALLBACK_HANDLER_VERSIONS].reverse();
}
```

### Prefer

Derive the list from `@safe-global/safe-deployments` so the source of
truth — the deployments package — drives the runtime set, and a
contract release does not need a coordinated edit in every consumer:

```ts
import { getCompatibilityFallbackHandlerDeployments } from '@safe-global/safe-deployments';

export function getFallbackHandlerVersions(): Array<string> {
  return getCompatibilityFallbackHandlerDeployments({ released: true })
    .map((d) => d.version)
    .sort(semverDescending);
}
```

### Why

Hardcoded version arrays drift behind the deployments package the
moment a new contract version ships. Deriving from the package keeps
the supported set self-updating — the only thing left to verify is
that the consuming code handles the new version's behavior, not that
someone remembered to add the string.

<sub>Source: <a href="examples/repositories-and-pagination.md#reuse-01-derive-version-lists-from-safe-deployments">examples/repositories-and-pagination.md#reuse-01-derive-version-lists-from-safe-deployments</a></sub>

</details>

---

<a id="style-01"></a>
### `STYLE-01` Document non-trivial code

> **general** · naming · 2 examples · ↩ `RL-20260506-005` · `RL-20260128-001` · `RL-20251222-001` · `RL-20260604-004` · `RL-20260609-001`

**📜 Rule**\
Public/non-trivial service and repository code is documented and free of dead branches, commented-out code, redundant comments, and `console.log`. Default flags safely (`isSafe = false` until proven), wrap event listeners with cleanup, and keep adapters' error contracts intact. Message/formatting logic beyond one branch gets a named helper in utils — no nested ternaries inside template literals. Destructuring return values is an accepted repo-wide pattern — do not demand named receivers; verify a claimed convention against the codebase before enforcing it.

**✅ Check**\
> Did I document public/non-trivial logic and remove dead code?

<details>
<summary><strong>💡 Example 1 of 2</strong> — <code>examples/error-handling.md</code> § <em>style-01-log-04-internal-errors-do-not-leak-into-user-responses</em></summary>

<br>

**STYLE-01 / LOG-04 — Internal errors do not leak into user responses**

Source: PR #2856 (RL-20251222-001)

### Avoid

Forwarding the raw caught error into the user-facing response field, and
shipping the temporary `console.log` left over from local debugging:

```ts
const request_id = response.headers.get(REQUEST_ID_HEADER) ?? undefined;

// TODO: remove logging after adding Blockaid error mapping:
console.log('!!!! data:', data);

try {
  // ...
} catch (error) {
  return this.failedAnalysisResponse(
    error instanceof Error ? error.message : String(error),
  );
}
```

### Prefer

Map known internal failures to a generic user-facing response and log
the raw cause through the structured logger; leave `console.log` out of
merged code:

```ts
const request_id = response.headers.get(REQUEST_ID_HEADER) ?? undefined;

try {
  // ...
} catch (error) {
  this.loggingService.error({ type: LogType.AnalysisFailure, cause: asError(error) });
  return this.failedAnalysisResponse();
}
```

### Why

A raw HTTP error or stack trace surfacing in an analysis response gives
the consumer information they cannot act on, and routinely leaks internal
hostnames or upstream error codes. Catch-and-log keeps the diagnostic
information in a place we can mine; the response stays at the boundary's
contract.

<sub>Source: <a href="examples/error-handling.md#style-01-log-04-internal-errors-do-not-leak-into-user-responses">examples/error-handling.md#style-01-log-04-internal-errors-do-not-leak-into-user-responses</a></sub>

</details>

<details>
<summary><strong>💡 Example 2 of 2</strong> — <code>examples/style.md</code> § <em>style-01-type-06-destructuring-with-the-same-name-shadows-the-outer-binding</em></summary>

<br>

**STYLE-01 / TYPE-06 — Destructuring with the same name shadows the outer binding**

Source: PR #2883 (RL-20260506-005)

### Avoid

Loop control depending on a `let` that the destructure inside the loop
silently shadows:

```ts
let next: string | null = null;
do {
  const page = await api.getPage({ offset });
  const { next, results } = pageSchema.parse(page); // shadows outer `next`
  allItems.push(...results);
  if (next) {
    offset = PaginationData.fromLimitAndOffset(new URL(next)).offset;
  }
} while (next); // outer `next` never reassigned, stays null forever
```

### Prefer

Either rename in the destructure and reassign the outer variable, or
project explicitly so the shadowing cannot happen:

```ts
let next: string | null = null;
do {
  const page = await api.getPage({ offset });
  const { next: nextUrl, results } = pageSchema.parse(page);
  next = nextUrl;
  allItems.push(...results);
  if (next) {
    offset = PaginationData.fromLimitAndOffset(new URL(next)).offset;
  }
} while (next);
```

### Why

The shadowed-`next` bug is invisible in review unless you read both the
declaration and the destructure together — the inner block looks correct
in isolation, and the loop "just runs once" in tests with single-page
fixtures. Renaming in the destructure makes the assignment to the outer
binding explicit and impossible to forget.

<sub>Source: <a href="examples/style.md#style-01-type-06-destructuring-with-the-same-name-shadows-the-outer-binding">examples/style.md#style-01-type-06-destructuring-with-the-same-name-shadows-the-outer-binding</a></sub>

</details>

---

## 🌐 general › types

<a id="type-01"></a>
### `TYPE-01` Use project types

> **general** · types · ↩ `RL-20260609-002` · `RL-20260612-003`

**📜 Rule**\
Use `Address`, `Hex`, project shared schemas (`@/validation/entities/schemas`), and `z.enum(getStringEnumKeys(Enum))` over `z.nativeEnum`. `Address` is reserved for 20-byte addresses; signatures, hashes, calldata are `Hex`. UUID-shaped fields use the nominal `UUID` type from `node:crypto`, not `string`. Do not re-normalize what the canonical schema already normalizes — `AddressSchema` returns the EIP-55 checksummed form; store that.

**✅ Check**\
> Did I use project types and shared schemas first?

---

<a id="type-02"></a>
### `TYPE-02` Schemas in entity files

> **general** · types · 1 example · ↩ `RL-20260123-002` · `RL-20260116-002` · `RL-20260619-003`

**📜 Rule**\
Reusable Zod schemas live in entity/schema files, not inline in services/controllers. Apply normalization (`.transform`, defaults) at the schema layer; prefer `.nullish()` over `.nullable().optional()`. Do not stack `.default(x)` after `.catch(x)` — `.catch` already handles undefined/invalid — and extract repeated fallback fragments to a shared const.

**✅ Check**\
> Are reusable schemas in entity/schema files?

<details>
<summary><strong>💡 Example</strong> — <code>examples/error-handling.md</code> § <em>type-02-type-03-empty-external-error-strings-normalize-to-absence</em></summary>

<br>

**TYPE-02 / TYPE-03 — Empty external error strings normalize to absence**

Source: PR #2866 (RL-20260116-002)

### Avoid

Returning the empty string as if it were a useful error, or testing for
absence with overly specific equality:

```ts
export const prepareErrorMessage = (error?: string): string | undefined => {
  if (error === undefined || error === '') return undefined;
  const match = error.match(/GS\d{3}/);
  if (!match) return error;
  const mapped = ERROR_MAPPING[match[0]];
  return mapped ?? error; // can be '' if a mapping is empty
};
```

### Prefer

Coalesce empty and undefined at the entry, drop the redundant check, and
keep the return type honest (`string | undefined`):

```ts
export const prepareErrorMessage = (error?: string): string | undefined => {
  if (!error) return undefined;
  const match = error.match(/GS\d{3}/);
  if (!match) return error;
  return ERROR_MAPPING[match[0]] ?? error;
};
```

### Why

When an external error carries no user-facing information (`''`), the
caller wants to render "no message," not an empty string. Pushing the
normalization into the helper keeps the contract simple — every caller
either gets a non-empty string or `undefined`, never both shapes for the
same notion of absence.

<sub>Source: <a href="examples/error-handling.md#type-02-type-03-empty-external-error-strings-normalize-to-absence">examples/error-handling.md#type-02-type-03-empty-external-error-strings-normalize-to-absence</a></sub>

</details>

---

<a id="type-03"></a>
### `TYPE-03` Validate external inputs

> **general** · types · 1 example · ↩ `RL-20260116-002` · `RL-20260526-001` · `RL-20260527-001` · `RL-20260605-003` · `RL-20260612-001`

**📜 Rule**\
Validate token claims, external responses, queued jobs, config strings, and `.every`-style predicate results before use. Predicate return values must be honored — no silent acceptance. Normalize at the validation boundary (e.g. a Zod `.toLowerCase()`/`.transform()`) so consumers receive ready-to-use values instead of repeating normalization per call site, and `.brand<'X'>()` validated value types so a same-shaped raw string cannot bypass the schema. Normalize case on both sides before strict equality of hex/address-like strings. Numeric-string ID schemas reject zero, leading zeros, signs, and floats (`/^[1-9]\d*$/`), and test-data generators must produce values that satisfy the same constraint (`faker.string.numeric()` allows leading zeros). Prefer Zod `.overwrite()` over `.transform()` for type-preserving normalization (dedup, casing) so the schema stays introspectable.

**✅ Check**\
> Are external responses, token claims, queued jobs, and config strings validated and normalized at the boundary (branded where it matters), and is case normalized before strict hex/address equality?

<details>
<summary><strong>💡 Example</strong> — <code>examples/error-handling.md</code> § <em>type-02-type-03-empty-external-error-strings-normalize-to-absence</em></summary>

<br>

**TYPE-02 / TYPE-03 — Empty external error strings normalize to absence**

Source: PR #2866 (RL-20260116-002)

### Avoid

Returning the empty string as if it were a useful error, or testing for
absence with overly specific equality:

```ts
export const prepareErrorMessage = (error?: string): string | undefined => {
  if (error === undefined || error === '') return undefined;
  const match = error.match(/GS\d{3}/);
  if (!match) return error;
  const mapped = ERROR_MAPPING[match[0]];
  return mapped ?? error; // can be '' if a mapping is empty
};
```

### Prefer

Coalesce empty and undefined at the entry, drop the redundant check, and
keep the return type honest (`string | undefined`):

```ts
export const prepareErrorMessage = (error?: string): string | undefined => {
  if (!error) return undefined;
  const match = error.match(/GS\d{3}/);
  if (!match) return error;
  return ERROR_MAPPING[match[0]] ?? error;
};
```

### Why

When an external error carries no user-facing information (`''`), the
caller wants to render "no message," not an empty string. Pushing the
normalization into the helper keeps the contract simple — every caller
either gets a non-empty string or `undefined`, never both shapes for the
same notion of absence.

<sub>Source: <a href="examples/error-handling.md#type-02-type-03-empty-external-error-strings-normalize-to-absence">examples/error-handling.md#type-02-type-03-empty-external-error-strings-normalize-to-absence</a></sub>

</details>

---

<a id="type-04"></a>
### `TYPE-04` DTO matches wire shape

> **general** · types · 4 examples · ↩ `RL-20260520-002` · `RL-20260108-002` · `RL-20251223-001` · `RL-20260602-003` · `RL-20260604-002` · `RL-20260612-006`

**📜 Rule**\
DTO/`@ApiProperty` fields must match the actual wire shape: required vs optional vs nullable; matching enum source; do not hardcode literal-array enums in `@ApiProperty`. Model exact-one alternatives as unions when the wire contract is either/or. Defense-in-depth checks downstream of upstream filters. The DTO's Zod schema must enforce the same bounds the `@ApiProperty` documents (reuse the canonical schema, e.g. `makeNameSchema()`, rather than a looser `z.string().max(...)`), and the DTO class should `implements z.infer<typeof Schema>` so schema/Swagger drift fails at compile time. Schema-centralization refactors preserve requiredness and bounds exactly, sweep sibling entities that share the field, and call out intentional behavior changes in the PR description. `@ApiPropertyOptional` only when the key can be absent; an always-present nullable field is `@ApiProperty({ nullable: true })`.

**✅ Check**\
> Do DTO fields match the actual wire shape, with the Zod schema enforcing the documented @ApiProperty bounds and the class implementing z.infer of its schema?

<details>
<summary><strong>💡 Example 1 of 4</strong> — <code>examples/schemas-and-validation.md</code> § <em>type-04-reuse-the-canonical-enum-do-not-hardcode-literal-arrays</em></summary>

<br>

**TYPE-04 — Reuse the canonical enum, do not hardcode literal arrays**

Source: PR #2854 (RL-20251223-001)

### Avoid

Hardcoding the same status string in `@ApiProperty.enum`, `z.literal`, and
the DTO type:

```ts
@ApiProperty({
  enum: ['UNOFFICIAL_FALLBACK_HANDLER'],
})
status!: 'UNOFFICIAL_FALLBACK_HANDLER';

export const UnofficialResultSchema = BaseSchema.extend({
  type: z.literal('UNOFFICIAL_FALLBACK_HANDLER'),
});
```

### Prefer

Define the canonical enum once and reuse it across the schema, the DTO,
and the controller's Swagger metadata:

```ts
export enum ContractStatus {
  UnofficialFallbackHandler = 'UNOFFICIAL_FALLBACK_HANDLER',
  // ...
}

@ApiProperty({ enum: ContractStatus })
status!: ContractStatus;

export const UnofficialResultSchema = BaseSchema.extend({
  type: z.literal(ContractStatus.UnofficialFallbackHandler),
});
```

### Why

Three copies of `'UNOFFICIAL_FALLBACK_HANDLER'` drift independently the
moment the contract changes. The Zod literal, the OpenAPI schema, and the
runtime check should all read from the same source so a renamed value
shows up as a single fix, not three near-misses scattered across modules.

<sub>Source: <a href="examples/schemas-and-validation.md#type-04-reuse-the-canonical-enum-do-not-hardcode-literal-arrays">examples/schemas-and-validation.md#type-04-reuse-the-canonical-enum-do-not-hardcode-literal-arrays</a></sub>

</details>

<details>
<summary><strong>💡 Example 2 of 4</strong> — <code>examples/schemas-and-validation.md</code> § <em>type-04-use-unions-for-exact-one-dto-shapes</em></summary>

<br>

**TYPE-04 — Use unions for exact-one DTO shapes**

Source: PR #3067 (RL-20260520-002)

### Avoid

Modeling an "address or email, but not both" payload as one loose object plus
cross-field refinement:

```ts
const InviteUserSchema = z
  .object({
    address: AddressSchema.optional(),
    email: z.email().max(255).optional(),
    role: z.enum(getStringEnumKeys(MemberRole)),
    name: NameSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.address && !value.email) {
      ctx.addIssue({ code: 'custom', path: ['address'] });
    }
  });
```

### Prefer

Make the two accepted wire shapes explicit:

```ts
const SharedInviteFields = {
  role: z.enum(getStringEnumKeys(MemberRole)),
  name: NameSchema,
};

const InviteUserSchema = z.union([
  z.object({ address: AddressSchema, ...SharedInviteFields }).strict(),
  z.object({ email: z.email().max(255), ...SharedInviteFields }).strict(),
]);
```

### Why

The union shows the API contract directly, gives better type narrowing to the
service/repository layer, and avoids misleading validation paths such as
pointing an email-only failure at `address`.

<sub>Source: <a href="examples/schemas-and-validation.md#type-04-use-unions-for-exact-one-dto-shapes">examples/schemas-and-validation.md#type-04-use-unions-for-exact-one-dto-shapes</a></sub>

</details>

<details>
<summary><strong>💡 Example 3 of 4</strong> — <code>examples/schemas-and-validation.md</code> § <em>type-04-strict-enum-schemas-for-internal-boolean-query-params</em></summary>

<br>

**TYPE-04 — Strict enum schemas for internal boolean query params**

Source: PR #2812 (RL-20260123-002)

### Avoid

Accepting any string and post-filtering, then redundantly piping through
`z.boolean()`:

```ts
const BooleanStringDefaultFalseSchema = z
  .string()
  .optional()
  .transform((val) => val === 'true')
  .pipe(z.boolean());
```

### Prefer

Constrain the wire shape to the two valid strings up front; the
`.transform` then has only two cases to handle:

```ts
const BooleanStringDefaultFalseSchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((val) => val === 'true');

const BooleanStringDefaultTrueSchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((val) => val !== 'false');
```

### Why

The endpoint is internal, so there is no ecosystem pressure to be lenient
with `''`, `'TRUE'`, or anything else; tightening the wire contract makes
the parser fail fast on garbage instead of quietly coercing it to `false`,
and removes the `.pipe(z.boolean())` belt-and-braces step.

<sub>Source: <a href="examples/schemas-and-validation.md#type-04-strict-enum-schemas-for-internal-boolean-query-params">examples/schemas-and-validation.md#type-04-strict-enum-schemas-for-internal-boolean-query-params</a></sub>

</details>

<details>
<summary><strong>💡 Example 4 of 4</strong> — <code>examples/controllers-and-swagger.md</code> § <em>type-04-route-01-public-params-apply-on-every-code-path-or-are-removed</em></summary>

<br>

**TYPE-04 / ROUTE-01 — Public params apply on every code path or are removed**

Source: PR #2840 (RL-20260108-002)

### Avoid

Accepting `trusted` and `excludeSpam` on the endpoint but silently
ignoring them when one provider path is taken:

```ts
async getSafeOverview({ chain, trusted, excludeSpam }: Args) {
  if (this.providerEnabled(chain)) {
    // provider returns all positions; trusted/excludeSpam ignored
    return this.providerApi.getOverview({ chain });
  }
  return this.legacyApi.getOverview({ chain, trusted, excludeSpam });
}
```

### Prefer

Pick one of:

1. Apply equivalent filtering on the provider path so behaviour matches
   on every chain.
2. Remove the parameter from the public endpoint when it cannot be
   honoured uniformly.
3. If neither is feasible yet, narrow the parameter's scope explicitly
   in the Swagger description and the controller's `@ApiQuery` so
   consumers can see the limitation.

```ts
@ApiQuery({
  name: 'trusted',
  required: false,
  type: Boolean,
  description: 'Restrict to trusted tokens. Ignored on chains served by ' +
               'the portfolio provider.',
})
```

### Why

Filters that work on some chains and not others are an undebuggable
behaviour difference for the consumer — the same query produces different
shapes depending on which chain is queried, and the API documentation
gives no hint. Either honour the param everywhere or stop accepting it.

<sub>Source: <a href="examples/controllers-and-swagger.md#type-04-route-01-public-params-apply-on-every-code-path-or-are-removed">examples/controllers-and-swagger.md#type-04-route-01-public-params-apply-on-every-code-path-or-are-removed</a></sub>

</details>

---

<a id="type-05"></a>
### `TYPE-05` Parser generics complete

> **general** · types

**📜 Rule**\
Parser/decode generics include every field the code reads downstream.

**✅ Check**\
> Do parser/decode types include every field the code reads?

---

<a id="type-06"></a>
### `TYPE-06` No unsafe casts

> **general** · types · 1 example · ↩ `RL-20260506-005` · `RL-20260612-004`

**📜 Rule**\
Avoid `as Type` casts that lie to the type system; use `Pick`/`Partial` parameter types and `unknown` with type guards. ConfigurationService generics must match the stored type, including `null`. Implementations keep the interface's declared narrow parameter types (no widening to `QueryDeepPartialEntity`), and payload type aliases derive from schemas (`z.infer<typeof Schema>['payload']`) instead of restating shapes.

**✅ Check**\
> Did I avoid unsafe casts, `any`, and silent type drift?

<details>
<summary><strong>💡 Example</strong> — <code>examples/style.md</code> § <em>style-01-type-06-destructuring-with-the-same-name-shadows-the-outer-binding</em></summary>

<br>

**STYLE-01 / TYPE-06 — Destructuring with the same name shadows the outer binding**

Source: PR #2883 (RL-20260506-005)

### Avoid

Loop control depending on a `let` that the destructure inside the loop
silently shadows:

```ts
let next: string | null = null;
do {
  const page = await api.getPage({ offset });
  const { next, results } = pageSchema.parse(page); // shadows outer `next`
  allItems.push(...results);
  if (next) {
    offset = PaginationData.fromLimitAndOffset(new URL(next)).offset;
  }
} while (next); // outer `next` never reassigned, stays null forever
```

### Prefer

Either rename in the destructure and reassign the outer variable, or
project explicitly so the shadowing cannot happen:

```ts
let next: string | null = null;
do {
  const page = await api.getPage({ offset });
  const { next: nextUrl, results } = pageSchema.parse(page);
  next = nextUrl;
  allItems.push(...results);
  if (next) {
    offset = PaginationData.fromLimitAndOffset(new URL(next)).offset;
  }
} while (next);
```

### Why

The shadowed-`next` bug is invisible in review unless you read both the
declaration and the destructure together — the inner block looks correct
in isolation, and the loop "just runs once" in tests with single-page
fixtures. Renaming in the destructure makes the assignment to the outer
binding explicit and impossible to forget.

<sub>Source: <a href="examples/style.md#style-01-type-06-destructuring-with-the-same-name-shadows-the-outer-binding">examples/style.md#style-01-type-06-destructuring-with-the-same-name-shadows-the-outer-binding</a></sub>

</details>

---

## 🌐 general › auth

<a id="auth-01"></a>
### `AUTH-01` Reuse auth assertions

> **general** · auth

**📜 Rule**\
Reuse existing auth assertions and predicates (`assertAuthenticated`, `getAuthenticatedUserIdOrFail`); branch signature recovery on `SignatureType` (only EOA/EthSign are recoverable).

**✅ Check**\
> Did I reuse existing auth assertions/predicates?

---

<a id="auth-02"></a>
### `AUTH-02` Identity supports SIWE and email

> **general** · auth

**📜 Rule**\
Identity code handles wallet (SIWE) and OIDC/email users; do not assume `signer_address` is set.

**✅ Check**\
> Does identity code handle wallet and email users?

---

<a id="auth-03"></a>
### `AUTH-03` Use proven auth/crypto libs

> **general** · auth

**📜 Rule**\
Prefer `jose` and other maintained libraries for JWKS/JWT and signature work over hand-rolled primitives.

**✅ Check**\
> Did I use proven auth/crypto libraries instead of custom primitives?

---

<a id="auth-04"></a>
### `AUTH-04` Email exposure intentional

> **general** · auth

**📜 Rule**\
User-email exposure in DTOs and Swagger is intentional and consistent.

**✅ Check**\
> Is user email exposure intentional and consistent?

---

<a id="auth-05"></a>
### `AUTH-05` Space routes enforce membership before data access

> **general** · auth · 1 example · ↩ `RL-20260520-001` · `RL-20260602-001`

**📜 Rule**\
Every space-scoped controller is guarded with `AuthGuard`, accepts the authenticated payload, and verifies space membership/admin authorization in the route service before querying or returning space-owned data. When the membership predicate is a TypeORM `where`, remember an array `where` is OR: every clause must carry the `user: { id }` ownership filter (a single unfiltered clause leaks other spaces, or matches all rows when its scope is undefined). Centralize the predicate in a shared helper and regression-test a non-member requesting a specific space id.

**✅ Check**\
> Did this add or change a space-scoped route or its membership `where`? If yes, is it auth-guarded, does the service assert membership/admin before data access, and does every OR clause of the `where` carry the user filter?

<details>
<summary><strong>💡 Example</strong> — <code>examples/auth-and-secrets.md</code> § <em>auth-05-every-or-clause-of-a-membership-where-carries-the-user-filter</em></summary>

<br>

**AUTH-05 — Every OR clause of a membership where carries the user filter**

Source: PR #3115 (RL-20260602-001)

### Avoid

```ts
// array where = OR; the third clause has no user filter
where: [
  { user: { id: userId }, status: 'ACTIVE' },
  { user: { id: userId }, status: 'INVITED', inviteExpiresAt: MoreThan(new Date()) },
  { ...(spaceId != null && { space: { id: spaceId } }) }, // matches any/all members
],
```

### Prefer

```ts
const where = activeOrPendingMemberWhere(() => ({
  ...(spaceId != null && { space: { id: spaceId } }),
})); // helper spreads `user: { id: userId }` into every clause
// → [{ user:{id}, status:'ACTIVE', space:{id} }, { user:{id}, status:'INVITED', inviteExpiresAt:MoreThan(now), space:{id} }]
```

### Why

TypeORM treats an array `where` as OR. A clause that omits the `user: { id }` predicate matches members of any space (or every row when its own scope is undefined), turning a membership query into an authorization bypass. Centralize the predicate in a helper so every OR branch carries the ownership filter, and regression-test a non-member requesting a specific space id.

<sub>Source: <a href="examples/auth-and-secrets.md#auth-05-every-or-clause-of-a-membership-where-carries-the-user-filter">examples/auth-and-secrets.md#auth-05-every-or-clause-of-a-membership-where-carries-the-user-filter</a></sub>

</details>

---

## 🌐 general › routes

<a id="route-01"></a>
### `ROUTE-01` Controllers are HTTP boundary

> **general** · routes · 3 examples · ↩ `RL-20260108-002` · `RL-20260108-003` · `RL-20251222-001`

**📜 Rule**\
Controllers stay at the HTTP boundary: no Provider naming in user-facing copy, no false standards labels (e.g. CAIP-10) the implementation does not satisfy, no domain `Error` for "not found" — throw `NotFoundException`/`ForbiddenException` so the global filter maps to the right status. Wrap parsing/IO inside the adapter's wrap-and-throw boundary.

**✅ Check**\
> Are controllers only HTTP boundary code?

<details>
<summary><strong>💡 Example 1 of 3</strong> — <code>examples/controllers-and-swagger.md</code> § <em>route-01-do-not-name-internal-providers-in-user-facing-swagger-copy</em></summary>

<br>

**ROUTE-01 — Do not name internal providers in user-facing Swagger copy**

Source: PR #2840 (RL-20260108-003)

### Avoid

Leaking the internal provider name into the public API documentation:

```ts
@ApiOperation({
  summary: 'Get Safe overview (v2)',
  description:
    'Retrieves an overview of multiple Safes using Zerion portfolio data ' +
    'for enabled chains. Supports cross-chain queries.',
})
```

### Prefer

Describe the contract from the consumer's perspective; let the controller
choose the implementation behind the scenes:

```ts
@ApiOperation({
  summary: 'Get Safe overview (v2)',
  description:
    'Retrieves an overview of multiple Safes across the supported chains.',
})
```

### Why

Provider names are internal infrastructure choices that change without a
contract bump. Documenting them ties consumers to an implementation detail
they should not depend on, and makes it harder to swap the backing source
(or run two side by side) without a noisy public diff.

<sub>Source: <a href="examples/controllers-and-swagger.md#route-01-do-not-name-internal-providers-in-user-facing-swagger-copy">examples/controllers-and-swagger.md#route-01-do-not-name-internal-providers-in-user-facing-swagger-copy</a></sub>

</details>

<details>
<summary><strong>💡 Example 2 of 3</strong> — <code>examples/controllers-and-swagger.md</code> § <em>route-01-do-not-claim-a-standard-the-implementation-does-not-satisfy</em></summary>

<br>

**ROUTE-01 — Do not claim a standard the implementation does not satisfy**

Source: PR #2840 (RL-20260108-003)

### Avoid

Labelling a parameter as a well-known standard when the format actually
accepted differs:

```ts
@ApiQuery({
  name: 'safes',
  type: String,
  description: 'Comma-separated list of Safe addresses in CAIP-10 format ' +
               '(chainId:address)',
})
```

### Prefer

Describe the format the controller actually parses, in its own words:

```ts
@ApiQuery({
  name: 'safes',
  type: String,
  description: 'Comma-separated list of `chainId:address` pairs',
})
```

### Why

CAIP-10 has a specific shape (`namespace:reference:account_address`).
Accepting `chainId:address` and labelling it CAIP-10 invites consumers to
parse it as the standard, fail on the first edge case, and blame the
spec. Naming the format honestly keeps the contract testable.

<sub>Source: <a href="examples/controllers-and-swagger.md#route-01-do-not-claim-a-standard-the-implementation-does-not-satisfy">examples/controllers-and-swagger.md#route-01-do-not-claim-a-standard-the-implementation-does-not-satisfy</a></sub>

</details>

<details>
<summary><strong>💡 Example 3 of 3</strong> — <code>examples/controllers-and-swagger.md</code> § <em>type-04-route-01-public-params-apply-on-every-code-path-or-are-removed</em></summary>

<br>

**TYPE-04 / ROUTE-01 — Public params apply on every code path or are removed**

Source: PR #2840 (RL-20260108-002)

### Avoid

Accepting `trusted` and `excludeSpam` on the endpoint but silently
ignoring them when one provider path is taken:

```ts
async getSafeOverview({ chain, trusted, excludeSpam }: Args) {
  if (this.providerEnabled(chain)) {
    // provider returns all positions; trusted/excludeSpam ignored
    return this.providerApi.getOverview({ chain });
  }
  return this.legacyApi.getOverview({ chain, trusted, excludeSpam });
}
```

### Prefer

Pick one of:

1. Apply equivalent filtering on the provider path so behaviour matches
   on every chain.
2. Remove the parameter from the public endpoint when it cannot be
   honoured uniformly.
3. If neither is feasible yet, narrow the parameter's scope explicitly
   in the Swagger description and the controller's `@ApiQuery` so
   consumers can see the limitation.

```ts
@ApiQuery({
  name: 'trusted',
  required: false,
  type: Boolean,
  description: 'Restrict to trusted tokens. Ignored on chains served by ' +
               'the portfolio provider.',
})
```

### Why

Filters that work on some chains and not others are an undebuggable
behaviour difference for the consumer — the same query produces different
shapes depending on which chain is queried, and the API documentation
gives no hint. Either honour the param everywhere or stop accepting it.

<sub>Source: <a href="examples/controllers-and-swagger.md#type-04-route-01-public-params-apply-on-every-code-path-or-are-removed">examples/controllers-and-swagger.md#type-04-route-01-public-params-apply-on-every-code-path-or-are-removed</a></sub>

</details>

---

<a id="route-02"></a>
### `ROUTE-02` Inputs validated at controller

> **general** · routes · ↩ `RL-20260123-002` · `RL-20260609-003` · `RL-20260612-005`

**📜 Rule**\
Validate params, query, and body at the controller via Zod schemas and `ValidationPipe`; do not duplicate presence checks in services. Cache-busting params should be booleans with server-generated keys, not unbounded client strings. Identifier-format validation lives in pipes/controllers with one shared error-message constant — repositories assume validated input and never throw HTTP exceptions for format errors. Comma-separated query params treat `''` like an omitted param (`.split(',').filter(Boolean)`).

**✅ Check**\
> Are params, query, and bodies validated?

---

<a id="route-03"></a>
### `ROUTE-03` Stable empty shapes

> **general** · routes · 1 example · ↩ `RL-20260114-002` · `RL-20260615-003` · `RL-20260619-004`

**📜 Rule**\
Use 403 (not 404) for permission failures with an existing resource. Empty responses use stable empty shapes. Assert membership/authorization before a guarded write — do not encode it in a WHERE clause whose `affected === 0` surfaces as 404 where siblings return 403. "Server has not implemented this" is 501, not 403; error-constructor params are typed with the enum callers pass, not `string`.

**✅ Check**\
> Do empty responses use stable empty shapes?

<details>
<summary><strong>💡 Example</strong> — <code>examples/error-handling.md</code> § <em>log-01-route-03-unknown-mappings-return-absence-not-a-plausible-default</em></summary>

<br>

**LOG-01 / ROUTE-03 — Unknown mappings return absence, not a plausible default**

Source: PR #2863 (RL-20260114-002)

### Avoid

Falling back to a plausible-looking default when an external mapping is
missing:

```ts
async getChainIdFromNetwork(networkName: string): Promise<string> {
  const chainId = mappings.nameToChainId[networkName];
  if (!chainId) {
    this.loggingService.warn(
      `Unknown network: "${networkName}", defaulting to Ethereum mainnet (chain ID 1)`,
    );
    return '1';
  }
  return chainId;
}
```

### Prefer

Return `undefined` (or throw, depending on the call site) and let the
caller fall back to the non-provider path or skip the item explicitly:

```ts
async getChainIdFromNetwork(networkName: string): Promise<string | undefined> {
  const chainId = mappings.nameToChainId[networkName];
  if (!chainId) {
    this.loggingService.warn(`Unknown network: "${networkName}"`);
    return undefined;
  }
  return chainId;
}
```

### Why

A "default to mainnet" branch silently ascribes balances and positions to
the wrong chain — the response looks valid, the metric is clean, and the
bug only shows up when a user notices their multi-chain wallet has the
wrong totals. Returning absence forces every caller to handle the
unknown case at the boundary they own.

<sub>Source: <a href="examples/error-handling.md#log-01-route-03-unknown-mappings-return-absence-not-a-plausible-default">examples/error-handling.md#log-01-route-03-unknown-mappings-return-absence-not-a-plausible-default</a></sub>

</details>

---

## 🌐 general › database

<a id="db-01"></a>
### `DB-01` Unique constraint matches lifecycle

> **general** · database

**📜 Rule**\
Unique constraints, status transitions, and races need lifecycle-aware handling: partial indexes for nullable uniques, deduplication migrations before adding constraints to existing tables, deterministic ordering for fallback rows (NULL + specific) so callers cannot pick non-deterministically.

**✅ Check**\
> Do unique constraints match nullable/lifecycle behavior?

---

<a id="db-02"></a>
### `DB-02` Atomic state transitions

> **general** · database · ↩ `RL-20260602-002` · `RL-20260605-002`

**📜 Rule**\
Multi-step status transitions are atomic (single SQL/ORM bulk call or wrapped transaction); do not loop awaits to mutate N rows. Writes that must commit or roll back together must run on the same outer `EntityManager`/transaction — a find-or-create helper invoked inside a transaction must accept and thread the outer `EntityManager` rather than opening its own, or a later failure leaves orphan committed rows. Conversely, do not wrap a single-statement write in a transaction — one statement is already atomic.

**✅ Check**\
> Are multi-step state transitions atomic, and do helpers called inside a transaction share the outer EntityManager instead of opening their own?

---

<a id="db-03"></a>
### `DB-03` No redundant DB trips

> **general** · database · ↩ `RL-20260529-003` · `RL-20260609-004`

**📜 Rule**\
Avoid redundant reads/writes and no-op DB trips; prefer `SELECT <explicit columns>` over `SELECT *` and extract repeated column lists to a shared constant. Read generated/default columns from a write's RETURNING instead of issuing a follow-up `find` — `generatedMaps` on inserts, `raw` on updates (TypeORM leaves `generatedMaps` empty for UPDATE).

**✅ Check**\
> Did I avoid redundant reads/writes and no-op DB trips, including a follow-up find for values the write already returns?

---

<a id="db-04"></a>
### `DB-04` DB errors mapped at write boundary

> **general** · database

**📜 Rule**\
Map uniqueness/constraint errors to domain errors at the repository boundary; include the conflicting key from `driverError.detail` in the message.

**✅ Check**\
> Are DB errors mapped at the write boundary?

---

<a id="db-05"></a>
### `DB-05` Migrations agree with code

> **general** · database · 2 examples · ↩ `RL-20260520-003` · `RL-20260506-007` · `RL-20260116-001` · `RL-20260601-001` · `RL-20260604-001`

**📜 Rule**\
Migrations, TypeORM entities, enum transformers, FK/index choices, rollback assumptions, and repository integration tests must agree. Status backfills must preserve the runtime invariants for that status and avoid raw enum ordinals when a narrower predicate is available. Index a column only if a query actually uses it; column max length must equal the validation constant (shared as a named constant between schema and entity, never an inline literal), and an entity column limit changes only together with the migration that enforces it; unique-constraint names follow `UQ_<table>_<field>_<field>`. A migration that joins/compares an address column whose entity uses a checksum transformer (`getAddress()`) must normalize both sides (`LOWER(...)`), or same-address rows stored with different casing fail to match.

**✅ Check**\
> Do migrations, entities, indexes, schemas, and tests agree, and do address joins normalize case (LOWER) on both sides when one side is checksum-transformed?

<details>
<summary><strong>💡 Example 1 of 2</strong> — <code>examples/database-migrations.md</code> § <em>db-05-do-not-use-the-recorded-migration-id-as-an-array-index</em></summary>

<br>

**DB-05 — Do not use the recorded migration `id` as an array index**

Source: PR #2804 (RL-20260506-007)

### Avoid

Slicing the migrations array by the last-run migration's `id`:

```ts
const last = await this.runHistoryRepo.findLastRunMigration();
const pending = migrations.slice(last?.id ?? 0); // id treated as index
for (const migration of pending) {
  await migration.run();
}
```

### Prefer

Filter by `id > last.id` so a non-contiguous numbering (gaps from deleted
deprecated migrations) does not silently truncate the slice:

```ts
const last = await this.runHistoryRepo.findLastRunMigration();
const lastId = last?.id ?? 0;
const pending = migrations.filter((m) => m.id > lastId);
for (const migration of pending) {
  await migration.run();
}
```

And add an integration test that exercises the gap case explicitly: a DB
that recorded `last.id = 15` while the on-disk migrations array has fewer
entries because earlier IDs were deleted.

### Why

The `slice(lastId)` form silently returns an empty array as soon as
deletes leave gaps in the numbering, so already-migrated installations
stop receiving new migrations and the bug only surfaces in production
weeks later. Filtering by `id > lastId` is honest: the slice start is the
ID, not the array position.

<sub>Source: <a href="examples/database-migrations.md#db-05-do-not-use-the-recorded-migration-id-as-an-array-index">examples/database-migrations.md#db-05-do-not-use-the-recorded-migration-id-as-an-array-index</a></sub>

</details>

<details>
<summary><strong>💡 Example 2 of 2</strong> — <code>examples/database-migrations.md</code> § <em>db-05-migration-metadata-is-reviewed-not-copy-pasted</em></summary>

<br>

**DB-05 — Migration metadata is reviewed, not copy-pasted**

Source: PR #2870 (RL-20260116-001)

### Avoid

Copying a migration template across campaigns and silently flipping a
metadata field that drives reporting/ownership:

```sql
-- migration N — Outreach 5
INSERT INTO outreach (..., team_name, ...) VALUES (..., 'Core Experience', ...);

-- migration N+12 — Outreach 7 (described as "update existing campaign")
INSERT INTO outreach (..., team_name, ...) VALUES (..., 'Wallet', ...);
-- team_name flipped: not an update of the existing campaign anymore
```

### Prefer

When a migration is described as an update of an existing campaign,
preserve the ownership/reporting metadata from the previous migration
unless the change is intentional and called out in the PR description:

```sql
INSERT INTO outreach (..., team_name, ...) VALUES (..., 'Core Experience', ...);
```

If the team really is changing, say so in the PR body and in a comment
above the column, since downstream reports key off this field.

### Why

Migration files are append-only ground truth, and `team_name` style fields
feed dashboards or routing rules that nobody re-reviews. A copy-paste from
a different template is invisible in the diff context but rewrites who
owns the outreach. Reading every metadata column in a migration against
the previous run is cheap; recovering attribution after a release is not.

<sub>Source: <a href="examples/database-migrations.md#db-05-migration-metadata-is-reviewed-not-copy-pasted">examples/database-migrations.md#db-05-migration-metadata-is-reviewed-not-copy-pasted</a></sub>

</details>

---

## 🌐 general › cache

<a id="cache-01"></a>
### `CACHE-01` Multi-step cache writes checked

> **general** · cache

**📜 Rule**\
Redis pipelines and cache marker writes must validate every meaningful result. HTTP cache TTLs derived from multiple Redis caches must use the shortest TTL or no-cache.

**✅ Check**\
> Are multi-step cache/Redis operations fully checked?

---

<a id="cache-02"></a>
### `CACHE-02` Cache keys cover all inputs

> **general** · cache · 3 examples · ↩ `RL-20260121-001` · `RL-20260114-001` · `RL-20251215-001`

**📜 Rule**\
Cache keys must include every input that changes the cached value (filters, flags like `useCircuitBreaker`, chain id, env, fiat-code casing). Bounded in-memory caches and expiry refresh need collision/TTL tests. `JSON.stringify` is not stable for keys; sort or canonicalize. When the cached value's shape changes, bump the key, version the payload, or invalidate on deploy.

**✅ Check**\
> Are cache keys, bounded caches, and TTL semantics tested?

<details>
<summary><strong>💡 Example 1 of 3</strong> — <code>examples/cache.md</code> § <em>cache-02-bump-the-key-when-the-cached-payload-shape-changes</em></summary>

<br>

**CACHE-02 — Bump the key when the cached payload shape changes**

Source: PR #2869 (RL-20260121-001)

### Avoid

Changing the value's shape but keeping the same cache key:

```ts
// before — cached value: { 'ethereum': '1', ... }
const cacheKey = 'zerion_chains:mapping';
const networkToChainId = JSON.parse(await cache.get(cacheKey));

// after — same key, new shape
const cacheKey = 'zerion_chains:mapping';
const { chainIdToName, nameToChainId } = JSON.parse(await cache.get(cacheKey));
// boom: post-deploy reads the OLD payload, chainIdToName is undefined
```

### Prefer

Either bump the key, version the payload, or invalidate on deploy — and
write the migration plan into the PR description so it does not get lost:

```ts
// option 1: bump the key suffix
const cacheKey = 'zerion_chains:mapping:v2';

// option 2: version the payload, fall back when the version is missing
const raw = JSON.parse(await cache.get(cacheKey));
if (raw?.version !== 2) await cache.invalidate(cacheKey);

// option 3: explicit cache invalidation in the deploy/migration step
await cache.invalidate('zerion_chains:mapping');
```

### Why

The old payload lives in Redis for hours after the deploy. Without a key
bump or version field, the new code reads the old shape, accesses
`undefined.something`, and takes balances/positions/portfolio offline for
the cache TTL of every affected user.

<sub>Source: <a href="examples/cache.md#cache-02-bump-the-key-when-the-cached-payload-shape-changes">examples/cache.md#cache-02-bump-the-key-when-the-cached-payload-shape-changes</a></sub>

</details>

<details>
<summary><strong>💡 Example 2 of 3</strong> — <code>examples/cache.md</code> § <em>cache-02-cache-router-owns-the-field-services-should-not-override</em></summary>

<br>

**CACHE-02 — Cache router owns the field, services should not override**

Source: PR #2863 (RL-20260114-001)

### Avoid

A service overriding the `field` returned by the `CacheRouter` cache
directory:

```ts
// in CacheRouter.getEntityChainsCacheDir
return { key, field: isTestnet ? 'mapping_testnet' : 'mapping' };

// in the service — silently overrides the router's field
const field = isReverse
  ? (isTestnet ? 'mapping_reverse_testnet' : 'mapping_reverse')
  : (isTestnet ? 'mapping_testnet' : 'mapping');
const cached = await this.cacheService.hGet({ ...cacheDir, field });
```

### Prefer

Pass the field-distinguishing arg into the router and let the router own
every field name in the directory:

```ts
// CacheRouter
return {
  key,
  field: this.fieldFor({ isTestnet, isReverse }),
};

// service
const cacheDir = router.getEntityChainsCacheDir({ isTestnet, isReverse });
const cached = await this.cacheService.hGet(cacheDir);
```

### Why

When a service post-mutates the field, the router signature lies — readers
trust `getEntityChainsCacheDir(isTestnet)` to be authoritative, miss the
override branch in the service, and write to the wrong hash field. Routing
all field selection through the router keeps "what lives at this key" in
one place.

<sub>Source: <a href="examples/cache.md#cache-02-cache-router-owns-the-field-services-should-not-override">examples/cache.md#cache-02-cache-router-owns-the-field-services-should-not-override</a></sub>

</details>

<details>
<summary><strong>💡 Example 3 of 3</strong> — <code>examples/cache.md</code> § <em>cache-02-cache-key-includes-every-input-that-toggles-behavior</em></summary>

<br>

**CACHE-02 — Cache key includes every input that toggles behavior**

Source: PR #2803 (RL-20251215-001)

### Avoid

Building the in-flight request cache key from `(url, options, timeout)`
while the wrapped call also takes a behavior toggle:

```ts
const get = async (url, options, timeout, useCircuitBreaker) => {
  const key = getCacheKey(url, options, timeout); // toggle missing
  if (cache[key]) return cache[key];
  cache[key] = request(url, options, timeout, useCircuitBreaker);
  return cache[key];
};
```

A request issued with `useCircuitBreaker: false` populates the cache; the
next call with `useCircuitBreaker: true` returns the same promise and
silently bypasses the breaker.

### Prefer

Pass every input that changes the wrapped behavior into the key:

```ts
const get = async (url, options, timeout, useCircuitBreaker) => {
  const key = getCacheKey(url, options, timeout, useCircuitBreaker);
  if (cache[key]) return cache[key];
  cache[key] = request(url, options, timeout, useCircuitBreaker);
  return cache[key];
};
```

### Why

In-flight caches dedupe identical work; "identical" must include every
input that toggles a side effect, or the cache turns into a covert
override of the toggle. The same applies to filters (`trusted`,
`excludeSpam`), sync/async modes, or any flag that picks a different
code path inside `request()`.

<sub>Source: <a href="examples/cache.md#cache-02-cache-key-includes-every-input-that-toggles-behavior">examples/cache.md#cache-02-cache-key-includes-every-input-that-toggles-behavior</a></sub>

</details>

---

## 🌐 general › config

<a id="config-01"></a>
### `CONFIG-01` Defaults safe and OSS-generic

> **general** · config

**📜 Rule**\
Defaults remain conservative and OSS-generic. Dev-only feature flags require both `flag === true` and `CGW_ENV === 'development'`.

**✅ Check**\
> Are defaults safe, minimal, and OSS-generic?

---

<a id="config-02"></a>
### `CONFIG-02` Config fails fast

> **general** · config · 1 example · ↩ `RL-20260506-004` · `RL-20251219-002` · `RL-20260608-001`

**📜 Rule**\
Config values and config tests belong in the canonical schema/test locations and fail fast on invalid production input. Validate range bounds (percentages, retries, page sizes); update every `invalidConfiguration` fixture when a new required field is added; reset `process.env.NODE_ENV` mutations in `afterEach`. Predicate-style validators must honor return values. Decorator-time constants need a top-level `process.env` read. Conditionally required env vars extend the shared deployed-env `superRefine` required-fields list with a `requiredWhen` condition — never standalone checks that also fire in local dev — and values a feature needs once enabled are read with `getOrThrow`.

**✅ Check**\
> Does config validation fail at startup?

<details>
<summary><strong>💡 Example</strong> — <code>examples/configuration.md</code> § <em>config-02-conditionally-required-env-vars-extend-the-deployed-env-required-list</em></summary>

<br>

**CONFIG-02 — Conditionally required env vars extend the deployed-env required list**

Source: PR #3135, #3142 (RL-20260608-001)

### Avoid

A standalone `superRefine` check for the new field, plus validation that
also fires in local development:

```ts
.superRefine((config, ctx) => {
  if (config.FF_FEATURE?.toLowerCase() === 'true' && !config.FEATURE_TOKEN_FILE) {
    ctx.addIssue({
      code: 'custom',
      message: 'is required when the feature is enabled',
      path: ['FEATURE_TOKEN_FILE'],
    });
  }
});
```

### Prefer

One deployed-env-only `superRefine` with a declarative required-fields
list; conditional requirements express themselves as `requiredWhen`:

```ts
.superRefine((config, ctx) => {
  const isDeployedEnv =
    !!config.CGW_ENV && ['production', 'staging'].includes(config.CGW_ENV);
  if (!isDeployedEnv) return;

  for (const {
    field,
    requiredWhen = true,
    message = 'is required in production and staging environments',
  } of [
    { field: 'PROVIDER_API_KEY' },
    {
      field: 'FEATURE_TOKEN_FILE',
      requiredWhen: config.FF_FEATURE?.toLowerCase() === 'true',
      message: 'is required in deployed environments when the feature is enabled',
    },
  ]) {
    if (requiredWhen && !(config as Record<string, unknown>)[field]) {
      ctx.addIssue({ code: 'custom', message, path: [field] });
    }
  }
});
```

Inside the feature module, read values the enabled feature needs with
`getOrThrow` so a deployed misconfiguration fails at startup, not at
first use.

### Why

The deployed-env guard exists so local development runs without
production secrets. A standalone check for a new field either re-fires
locally (defeating the guard) or duplicates the env gating. One
extendable list keeps every conditionally required var in one place,
with per-field conditions and messages.

<sub>Source: <a href="examples/configuration.md#config-02-conditionally-required-env-vars-extend-the-deployed-env-required-list">examples/configuration.md#config-02-conditionally-required-env-vars-extend-the-deployed-env-required-list</a></sub>

</details>

---

<a id="config-03"></a>
### `CONFIG-03` TTLs are config

> **general** · config · 1 example · ↩ `RL-20260506-003` · `RL-20260608-004`

**📜 Rule**\
TTLs/timeouts/cache settings and environment-specific URLs are configured, not hardcoded (a TODO does not ship). Follow precedents in similar repositories before introducing new hardcoded knobs.

**✅ Check**\
> Are TTLs/timeouts/tunables configured?

<details>
<summary><strong>💡 Example</strong> — <code>examples/repositories-and-pagination.md</code> § <em>config-03-reuse-01-knobs-follow-the-existing-config-driven-precedent</em></summary>

<br>

**CONFIG-03 / REUSE-01 — Knobs follow the existing config-driven precedent**

Source: PR #2883 (RL-20260506-003)

### Avoid

Hardcoding a pagination/threshold knob in a new repository when sibling
repositories already read the same kind of value from configuration:

```ts
export class EntityRepository {
  async getAllByOwnerV2(...) {
    // Safety limit to prevent infinite loops
    // todo move to config, similar to chains and contracts repositories?
    const maxSequentialPages = 10;
    // ...
  }
}
```

### Prefer

Inject `IConfigurationService`, follow the precedent (`ChainsRepository`,
`ContractsRepository`) and add the knob to `configuration.ts` plus the
test fixture in the same PR:

```ts
export class EntityRepository {
  private readonly maxSequentialPages: number;

  constructor(
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    /* ... */
  ) {
    this.maxSequentialPages = configurationService.getOrThrow<number>(
      'entity.entitiesByOwner.maxSequentialPages',
    );
  }
}
```

### Why

Hardcoded knobs drift from the rest of the repo as ops needs change —
ChainsRepository can be tuned without a deploy, the new one cannot. The
TODO comment in the diff captures the author's awareness; promote it to a
real config entry now, while the surrounding code is fresh.

<sub>Source: <a href="examples/repositories-and-pagination.md#config-03-reuse-01-knobs-follow-the-existing-config-driven-precedent">examples/repositories-and-pagination.md#config-03-reuse-01-knobs-follow-the-existing-config-driven-precedent</a></sub>

</details>

---

<a id="config-04"></a>
### `CONFIG-04` Pinned runtime versions

> **general** · config

**📜 Rule**\
Runtime dependency versions are pinned exactly; do not hardcode contract versions/addresses that exist in `safe-deployments`.

**✅ Check**\
> Are runtime dependencies pinned exactly?

---

<a id="config-05"></a>
### `CONFIG-05` Env metadata matches runtime

> **general** · config · 2 examples · ↩ `RL-20260108-001` · `RL-20251215-003` · `RL-20260619-002`

**📜 Rule**\
Toolchain versions, Docker build args, pinned CI actions, and `.env.sample`/`.env.sample.json` required flags should not drift from runtime behavior. Add new env vars to `.env.sample` in the same PR. Removing env-driven behavior sweeps every env-metadata surface (`.env.sample`, `.env.sample.json`, `.devcontainer/docker-compose.yml`) in the same PR.

**✅ Check**\
> Do tool versions and env metadata match runtime behavior?

<details>
<summary><strong>💡 Example 1 of 2</strong> — <code>examples/configuration.md</code> § <em>change-04-config-05-env-var-rename-keeps-the-old-name-as-a-fallback-for-one-release</em></summary>

<br>

**CHANGE-04 / CONFIG-05 — Env-var rename keeps the old name as a fallback for one release**

Source: PR #2851 (RL-20260108-001)

### Avoid

Renaming an env var in the configuration loader while the PR description
claims backwards compatibility, and updating only `.env.sample` for the
new name:

```ts
// configuration.ts
features: {
  // was: FF_ZERION_BALANCES_CHAIN_IDS
  zerionBalancesEnabled: !!process.env.FF_ZERION_ENABLED,
},
```

Existing deployments still ship with `FF_ZERION_BALANCES_CHAIN_IDS=...`
in their environment and quietly turn the feature off on the next
release.

### Prefer

Read both names for one release; document the new name as authoritative
in `.env.sample`; remove the legacy fallback only in a follow-up PR:

```ts
// configuration.ts
features: {
  zerionBalancesEnabled:
    !!process.env.FF_ZERION_ENABLED ||
    !!process.env.FF_ZERION_BALANCES_CHAIN_IDS, // legacy, remove next release
},
```

`.env.sample` lists the new var with the canonical default; the old
name is mentioned in a comment so operators know what to migrate from.

### Why

Env vars are part of the deployed contract. A rename without a fallback
is a silent feature flip on every consumer that did not redeploy with
the new name. Reading both for one release lets operations migrate
during a normal rollout window, after which the legacy branch can be
deleted with a clean PR that only touches the loader.

<sub>Source: <a href="examples/configuration.md#change-04-config-05-env-var-rename-keeps-the-old-name-as-a-fallback-for-one-release">examples/configuration.md#change-04-config-05-env-var-rename-keeps-the-old-name-as-a-fallback-for-one-release</a></sub>

</details>

<details>
<summary><strong>💡 Example 2 of 2</strong> — <code>examples/configuration.md</code> § <em>config-05-envsample-comments-document-encoding-and-format-constraints</em></summary>

<br>

**CONFIG-05 — `.env.sample` comments document encoding and format constraints**

Source: PR #2849 (RL-20251215-003)

### Avoid

A bare `KEY=` placeholder in `.env.sample` when the variable has a
non-obvious encoding or format requirement:

```sh
# The API Key to be used. If none is set, balances cannot be retrieved
# using this provider.
# ZERION_API_KEY=
```

### Prefer

Document the encoding/format right next to the variable, so an operator
copying `.env.sample` to `.env` sees the constraint without consulting
the README:

```sh
# The API Key to be used. If none is set, balances cannot be retrieved
# using this provider. Must be the base64-encoded key — see
# https://developers.zerion.io/reference/authentication for details.
# ZERION_API_KEY=
```

### Why

`.env.sample` is the only file most operators read when wiring a fresh
deployment. README references get skimmed; a wrong-shape value (raw key
instead of base64, comma-separated instead of JSON, etc.) silently
disables the feature and the failure mode is "request returns 401" days
later. A one-line comment at the variable closes that gap.

<sub>Source: <a href="examples/configuration.md#config-05-envsample-comments-document-encoding-and-format-constraints">examples/configuration.md#config-05-envsample-comments-document-encoding-and-format-constraints</a></sub>

</details>

---

## 🌐 general › performance

<a id="perf-01"></a>
### `PERF-01` Batch and parallelize I/O

> **general** · performance · 2 examples · ↩ `RL-20260506-006` · `RL-20260603-001` · `RL-20260619-001`

**📜 Rule**\
Batch repeated DB/API work, cap user limits, and keep independent I/O parallel. `Promise.all` over independent items must use `allSettled` if one failure should not sink the page. Remove event listeners (`res.once`, stream cleanup) to prevent leaks. Objects derived only from constructor-time config (Zod schemas, clients, compiled regexes) are built once in the constructor, not per request.

**✅ Check**\
> Did I batch repeated DB/API work, cap user limits, and keep independent I/O parallel?

<details>
<summary><strong>💡 Example 1 of 2</strong> — <code>examples/repositories-and-pagination.md</code> § <em>perf-01-extract-the-field-you-actually-need-per-page</em></summary>

<br>

**PERF-01 — Extract the field you actually need per page**

Source: PR #2883 (RL-20260506-006)

### Avoid

Accumulating full upstream objects across paginated requests when only one
field flows downstream:

```ts
const allEntities: Array<EntityV2> = [];
do {
  const { next, results } = EntityPageV2Schema.parse(page);
  allEntities.push(...results); // each EntityV2 carries fields we never use
  // fetch next page using next
} while (next);

return allEntities.map((e) => e.address);
```

### Prefer

Extract the field per page so memory grows only with the values that are
actually returned:

```ts
const allAddresses: Array<Address> = [];
do {
  const { next, results } = EntityPageV2Schema.parse(page);
  for (const entity of results) {
    allAddresses.push(entity.address);
  }
  // fetch next page using next
} while (next);

return allAddresses;
```

### Why

A 10-page response with 200 entities/page holds 2 000 full objects in
memory just to project to addresses at the end. Pushing the projected
field per page keeps the working set proportional to the answer, not to
the upstream's response shape, and shows up immediately when a user has a
deep pagination depth.

<sub>Source: <a href="examples/repositories-and-pagination.md#perf-01-extract-the-field-you-actually-need-per-page">examples/repositories-and-pagination.md#perf-01-extract-the-field-you-actually-need-per-page</a></sub>

</details>

<details>
<summary><strong>💡 Example 2 of 2</strong> — <code>examples/repositories-and-pagination.md</code> § <em>perf-01-parallelize-independent-lookups-with-promiseall</em></summary>

<br>

**PERF-01 — Parallelize independent lookups with Promise.all**

Source: PR #3131 (RL-20260603-001)

### Avoid

Sequential awaits for lookups that do not depend on each other:

```ts
const members = await this.membersRepository.findAuthorizedMembersOrFail({
  authPayload: args.authPayload,
  spaceId: args.spaceId,
});
const isActiveAdmin = Boolean(
  await this.membersRepository.findActiveAdmin({
    userId: getAuthenticatedUserIdOrFail(args.authPayload),
    spaceId: args.spaceId,
  }),
);
```

### Prefer

One `Promise.all` so the request path pays a single round-trip latency:

```ts
const [members, activeAdmin] = await Promise.all([
  this.membersRepository.findAuthorizedMembersOrFail({
    authPayload: args.authPayload,
    spaceId: args.spaceId,
  }),
  this.membersRepository.findActiveAdmin({
    userId: getAuthenticatedUserIdOrFail(args.authPayload),
    spaceId: args.spaceId,
  }),
]);
const isActiveAdmin = Boolean(activeAdmin);
```

### Why

Each awaited repository call is a database round trip. When the second
lookup does not consume the first's result, sequencing them doubles the
endpoint's latency floor for no benefit; `Promise.all` keeps the
independent I/O concurrent and fails fast on the first rejection.

<sub>Source: <a href="examples/repositories-and-pagination.md#perf-01-parallelize-independent-lookups-with-promiseall">examples/repositories-and-pagination.md#perf-01-parallelize-independent-lookups-with-promiseall</a></sub>

</details>

---

## 🌐 general › tests

<a id="test-01"></a>
### `TEST-01` Use builders and fakes

> **general** · tests · 1 example · ↩ `RL-20260506-002` · `RL-20260521-001` · `RL-20260619-005`

**📜 Rule**\
Tests use `Builder<T>` + `.with(field, value)`, `FakeCacheService`, and project test helpers; instantiate services directly (`new FooService(mockRepo)`) instead of `Test.createTestingModule` for service unit specs; avoid `jest.mock(...)` of unused modules. `Builder.with()` mutates and returns `this`, so build a fresh builder per case — never reuse one mutable builder across multiple cases/assertions, or state leaks and tests pass for the wrong reason. Builder defaults must not randomize across semantically different, behavior-routing values (`faker.helpers.arrayElement([...enum, null])`) — pick one stable valid default and override per test.

**✅ Check**\
> Did I use builders, fakes, and existing test helpers, and build a fresh builder per case rather than reusing a mutated one?

<details>
<summary><strong>💡 Example</strong> — <code>examples/testing.md</code> § <em>test-01-use-a-builder-for-repeated-entity-fixtures</em></summary>

<br>

**TEST-01 — Use a builder for repeated entity fixtures**

Source: PR #2884, #2883 (RL-20260506-002)

### Avoid

Copy-pasting object literals across tests when the same entity shape is
constructed more than once:

```ts
const entity = {
  fallbackHandler: getAddress(faker.finance.ethereumAddress()),
  guard: getAddress(faker.finance.ethereumAddress()),
  moduleGuard: getAddress(faker.finance.ethereumAddress()),
  enabledModules: [getAddress(faker.finance.ethereumAddress())],
};
```

### Prefer

A `Builder<T>` with `.with(field, value)` that lives next to the entity, so
each test only spells out the fields it cares about:

```ts
const entity = entityBuilder()
  .with('guard', specificGuard)
  .build();
```

### Why

Inline literals drift across tests as the entity shape evolves; a missing
field one place and an out-of-date constant in another silently weaken
assertions. The repo's `Builder<T>` pattern keeps a single source of truth
for each shape and lets a test override only what matters to that case.

<sub>Source: <a href="examples/testing.md#test-01-use-a-builder-for-repeated-entity-fixtures">examples/testing.md#test-01-use-a-builder-for-repeated-entity-fixtures</a></sub>

</details>

---

<a id="test-02"></a>
### `TEST-02` Right test layer (pyramid)

> **general** · tests · 1 example · ↩ `RL-20260506-001` · `RL-20260508-001` · `RL-20260529-004`

**📜 Rule**\
Test business logic with unit tests; test wiring and contracts with integration/e2e. Push negative paths and branch coverage to the lowest layer that can prove the property: schema/zod rules → schema unit (`*.dto.entity.spec.ts` or similar); service/repository branches (auth assertions, affected=0, error mapping) → service/repo unit; route wiring + global filter mappings (`NotFoundException → 404`, `ForbiddenException → 403`, validation → 422) → integration/e2e. End-to-end tests prove wiring once per route, not once per branch — one representative 4xx mapping smoke per route is enough; do not duplicate per-branch negatives at higher layers. Layout still applies: `*.spec.ts` for unit (no Postgres/Redis/RabbitMQ, no Nest bootstrap), `*.integration.spec.ts` for DB/Nest-bootstrapped, `*.e2e-spec.ts` for full HTTP flow. Tests in `src/__tests__/` are reserved for shared resources. Test private methods through public callers; extract a helper if direct testing is required. Decision rule: "Can I test this meaningfully without starting the app, database, network, or framework?" If yes, it is a unit test.

**✅ Check**\
> Does each assertion live at the lowest layer that can prove it, and did I avoid duplicating the same scenario across unit, integration, and e2e?

<details>
<summary><strong>💡 Example</strong> — <code>examples/testing.md</code> § <em>test-02-suffix-matches-the-test-layer</em></summary>

<br>

**TEST-02 — Suffix matches the test layer**

Source: PR #2886, #2884 (RL-20260506-001) — also relevant to NAME-01

### Avoid

Picking the suffix to match sibling files:

```text
src/modules/owners/routes/
├── owners.controller.v1.spec.ts             // unit
├── owners.controller.v2.spec.ts             // unit
└── owners.controller.v3.integration.spec.ts // boots Nest, hits DB
```

…or the inverse, naming a Nest-bootstrapped suite `*.spec.ts` because the
neighbours do.

### Prefer

Pick the suffix from what the test actually does:

- `*.spec.ts` — unit, no Nest bootstrap, no DB / Redis / queue.
- `*.integration.spec.ts` — boots Nest modules or hits a real DB.

If the existing siblings have the wrong suffix for the layer they exercise,
that is a separate cleanup, not a reason to keep extending the wrong name.

### Why

Two reviewers in the same week pulled in opposite directions on this PR —
one asked for `.spec.ts` for sibling consistency, the other asked for
`.integration.spec.ts` because the suite booted Nest. The team's answer is
that the suffix encodes the test layer, not the file's neighbours, so unit
runs can stay fast and integration runs stay reproducible.

<sub>Source: <a href="examples/testing.md#test-02-suffix-matches-the-test-layer">examples/testing.md#test-02-suffix-matches-the-test-layer</a></sub>

</details>

---

<a id="test-03"></a>
### `TEST-03` No internal mock chains

> **general** · tests

**📜 Rule**\
Do not mock internal query-builder chains or implementation details.

**✅ Check**\
> Did I avoid mocking internal query-builder chains?

---

<a id="test-04"></a>
### `TEST-04` Cover security paths

> **general** · tests · 1 example · ↩ `RL-20260506-004` · `RL-20251223-002` · `RL-20251219-001` · `RL-20260615-001`

**📜 Rule**\
Security-sensitive paths and error scenarios have explicit negative-path coverage. HTML/free-text user input has sanitizer tests with `<script>` and entity-encoded payloads. Negative authorization tests isolate exactly one denial factor — an ACTIVE non-admin for role checks, a pending member for status checks — so the rejection cannot come from an unrelated condition.

**✅ Check**\
> Are security and negative paths covered?

<details>
<summary><strong>💡 Example</strong> — <code>examples/testing.md</code> § <em>test-04-when-a-required-field-is-added-to-config-update-every-fixture</em></summary>

<br>

**TEST-04 — When a required field is added to config, update every fixture**

Source: PR #2873 (RL-20260506-004)

### Avoid

Adding a new required field to the validated configuration schema and
updating only the `validConfiguration` fixture:

```ts
// configuration.schema.ts
RootConfigurationSchema = z.object({
  // ...
  REQUIRED_NEW_FIELD: z.string(), // newly required
});

// __tests__/configuration.ts
export const validConfiguration = { ..., REQUIRED_NEW_FIELD: 'value' };
// invalidConfiguration variants left as-is — still missing REQUIRED_NEW_FIELD
```

### Prefer

Add the field to every fixture the schema is parsed against, including
`invalidConfiguration` variants that test unrelated invalid fields, plus the
`it.each` listing required keys:

```ts
const baseInvalid = { ..., REQUIRED_NEW_FIELD: 'value' };
export const invalidLogLevelConfig = { ...baseInvalid, LOG_LEVEL: 'wat' };
// it.each for required keys also lists REQUIRED_NEW_FIELD
```

### Why

If `invalidLogLevelConfig` is missing `REQUIRED_NEW_FIELD`, the parser fails
on the new field rather than the intended `LOG_LEVEL` problem, so the test
silently asserts the wrong thing and looks green for the wrong reason.

<sub>Source: <a href="examples/testing.md#test-04-when-a-required-field-is-added-to-config-update-every-fixture">examples/testing.md#test-04-when-a-required-field-is-added-to-config-update-every-fixture</a></sub>

</details>

---

<a id="test-05"></a>
### `TEST-05` Scoped test cleanup

> **general** · tests · 1 example · ↩ `RL-20251219-002`

**📜 Rule**\
Test setup/cleanup is scoped, not global workaround cleanup. `process.env.NODE_ENV` and other env mutations restore in `afterEach`.

**✅ Check**\
> Is test cleanup scoped and minimal?

<details>
<summary><strong>💡 Example</strong> — <code>examples/testing.md</code> § <em>test-05-restore-processenv-and-trim-secret-shaped-strings</em></summary>

<br>

**TEST-05 — Restore `process.env` and trim secret-shaped strings**

Source: PR #2829 (RL-20251219-002)

### Avoid

Mutating `process.env.NODE_ENV` per test without restoring, and validating
secret-shaped strings without trimming:

```ts
it('rejects empty API_KEY in production', () => {
  process.env.NODE_ENV = 'production';
  expect(() => validate({ API_KEY: '' })).toThrow();
});
// other tests now also see NODE_ENV=production
```

### Prefer

Snapshot `NODE_ENV` once at file scope and restore in `afterEach`; assert
that whitespace-only secrets are rejected because the validator trims:

```ts
let originalNodeEnv: string | undefined;
beforeAll(() => { originalNodeEnv = process.env.NODE_ENV; });
afterEach(() => { process.env.NODE_ENV = originalNodeEnv; });

it.each(['', '   '])('rejects blank API_KEY in production', (apiKey) => {
  process.env.NODE_ENV = 'production';
  expect(() => validate({ API_KEY: apiKey })).toThrow();
});
```

### Why

Leaking `NODE_ENV=production` into later tests is a classic order-dependent
failure — pass alone, fail in suite. The `'   '` row catches the easy
mistake of letting whitespace stand in for a configured secret.

<sub>Source: <a href="examples/testing.md#test-05-restore-processenv-and-trim-secret-shaped-strings">examples/testing.md#test-05-restore-processenv-and-trim-secret-shaped-strings</a></sub>

</details>

---

<a id="test-06"></a>
### `TEST-06` Fixtures fail loudly

> **general** · tests

**📜 Rule**\
Fixtures fail loudly when required deployments/data are absent — no silent skip.

**✅ Check**\
> Do fixtures fail loudly instead of silently skipping?

---

<a id="test-07"></a>
### `TEST-07` Pipeline coverage

> **general** · tests · ↩ `RL-20260123-001` · `RL-20260121-001` · `RL-20260114-002`

**📜 Rule**\
Implementation-selection changes (provider, mapper, datasource) need full-pipeline coverage end to end.

**✅ Check**\
> Are routing/precedence pipelines covered end to end?

---

<a id="test-08"></a>
### `TEST-08` Test names match assertions

> **general** · tests · ↩ `RL-20260602-005` · `RL-20260615-002`

**📜 Rule**\
Test descriptions and generated data reflect the actual assertion: `it('should return false when there is no source swap')` not `'when bridging to a different chain'`. Avoid redundant `expect(success).toBe(true); if (success) { ... }`. Fixture values reflect domain semantics even when unasserted — an admin's `invitedBy` is `null`, not a random int. Test helpers are named after the state they produce (`createActiveMember` vs `createPendingMember`), with the same terminology used across specs.

**✅ Check**\
> Do test names, fixtures, and generated data match the assertions and the domain semantics?

---

<a id="test-09"></a>
### `TEST-09` Cover edges and determinism

> **general** · tests · 1 example · ↩ `RL-20260123-001` · `RL-20260113-001` · `RL-20251223-002` · `RL-20260615-004`

**📜 Rule**\
Edge cases, observability calls, cache invalidation branches, production/default config branches, and deterministic ordering need tests when they are part of the behavior. Cache-invalidation tests pair every cleared-cache assertion with a negative assertion that unrelated caches stay untouched.

**✅ Check**\
> Do tests cover edge cases, side effects, and deterministic behavior?

<details>
<summary><strong>💡 Example</strong> — <code>examples/testing.md</code> § <em>test-09-cover-the-negative-paths-around-safety-critical-extraction</em></summary>

<br>

**TEST-09 — Cover the negative paths around safety-critical extraction**

Source: PR #2854 (RL-20251223-002)

### Avoid

Testing only the positive path of a security-relevant extractor:

```ts
it('returns UNOFFICIAL when handler is not official Safe or trusted', () => {
  // happy path only — extracts handler, classifies as unofficial
});
```

### Prefer

Add explicit negative-path tests for the inputs an attacker or buggy caller
can supply:

```ts
it('returns undefined when the parameter name does not match');
it('returns undefined when the address fails isAddress');
it('keeps the last value when setHandler is called multiple times');
it('returns undefined when tx.data exists but parameters are missing');
it('omits the warning when the handler is an official Safe handler');
```

### Why

The bug class here is "we extract or classify, but the inputs we did not
test slip through and reach a downstream branch that assumes shape." Each
negative-path test pins one of those slipping inputs, including the
official-handler false-positive path that exists specifically to suppress
noise.

<sub>Source: <a href="examples/testing.md#test-09-cover-the-negative-paths-around-safety-critical-extraction">examples/testing.md#test-09-cover-the-negative-paths-around-safety-critical-extraction</a></sub>

</details>

---

## 🌐 general › logging

<a id="log-01"></a>
### `LOG-01` Operational log levels

> **general** · logging · 1 example · ↩ `RL-20260121-001` · `RL-20260114-002`

**📜 Rule**\
Log levels reflect operational actionability. Expected business outcomes are not `error`. Default-fallback paths log a `warn` and return `undefined`/throw, not a plausible-looking wrong value.

**✅ Check**\
> Are log levels operationally appropriate?

<details>
<summary><strong>💡 Example</strong> — <code>examples/error-handling.md</code> § <em>log-01-route-03-unknown-mappings-return-absence-not-a-plausible-default</em></summary>

<br>

**LOG-01 / ROUTE-03 — Unknown mappings return absence, not a plausible default**

Source: PR #2863 (RL-20260114-002)

### Avoid

Falling back to a plausible-looking default when an external mapping is
missing:

```ts
async getChainIdFromNetwork(networkName: string): Promise<string> {
  const chainId = mappings.nameToChainId[networkName];
  if (!chainId) {
    this.loggingService.warn(
      `Unknown network: "${networkName}", defaulting to Ethereum mainnet (chain ID 1)`,
    );
    return '1';
  }
  return chainId;
}
```

### Prefer

Return `undefined` (or throw, depending on the call site) and let the
caller fall back to the non-provider path or skip the item explicitly:

```ts
async getChainIdFromNetwork(networkName: string): Promise<string | undefined> {
  const chainId = mappings.nameToChainId[networkName];
  if (!chainId) {
    this.loggingService.warn(`Unknown network: "${networkName}"`);
    return undefined;
  }
  return chainId;
}
```

### Why

A "default to mainnet" branch silently ascribes balances and positions to
the wrong chain — the response looks valid, the metric is clean, and the
bug only shows up when a user notices their multi-chain wallet has the
wrong totals. Returning absence forces every caller to handle the
unknown case at the boundary they own.

<sub>Source: <a href="examples/error-handling.md#log-01-route-03-unknown-mappings-return-absence-not-a-plausible-default">examples/error-handling.md#log-01-route-03-unknown-mappings-return-absence-not-a-plausible-default</a></sub>

</details>

---

<a id="log-02"></a>
### `LOG-02` No noisy success logs

> **general** · logging

**📜 Rule**\
Hot worker events and expected success paths are not noisy logs.

**✅ Check**\
> Did I avoid noisy success logs?

---

<a id="log-03"></a>
### `LOG-03` Telemetry cost-justified

> **general** · logging

**📜 Rule**\
New telemetry must be worth its operational cost.

**✅ Check**\
> Is any new telemetry worth its operational cost?

---

<a id="log-04"></a>
### `LOG-04` Structured logs and asError

> **general** · logging · 2 examples · ↩ `RL-20251222-001` · `RL-20251219-001`

**📜 Rule**\
Structured logs use `LogType`; caught values use `asError`. Internal error/exception messages do not flow into user-facing API response fields. Errors thrown from infrastructure include identifying context (which Safe, chainId, constraint key).

**✅ Check**\
> Did I use structured log types and error normalization helpers?

<details>
<summary><strong>💡 Example 1 of 2</strong> — <code>examples/error-handling.md</code> § <em>style-01-log-04-internal-errors-do-not-leak-into-user-responses</em></summary>

<br>

**STYLE-01 / LOG-04 — Internal errors do not leak into user responses**

Source: PR #2856 (RL-20251222-001)

### Avoid

Forwarding the raw caught error into the user-facing response field, and
shipping the temporary `console.log` left over from local debugging:

```ts
const request_id = response.headers.get(REQUEST_ID_HEADER) ?? undefined;

// TODO: remove logging after adding Blockaid error mapping:
console.log('!!!! data:', data);

try {
  // ...
} catch (error) {
  return this.failedAnalysisResponse(
    error instanceof Error ? error.message : String(error),
  );
}
```

### Prefer

Map known internal failures to a generic user-facing response and log
the raw cause through the structured logger; leave `console.log` out of
merged code:

```ts
const request_id = response.headers.get(REQUEST_ID_HEADER) ?? undefined;

try {
  // ...
} catch (error) {
  this.loggingService.error({ type: LogType.AnalysisFailure, cause: asError(error) });
  return this.failedAnalysisResponse();
}
```

### Why

A raw HTTP error or stack trace surfacing in an analysis response gives
the consumer information they cannot act on, and routinely leaks internal
hostnames or upstream error codes. Catch-and-log keeps the diagnostic
information in a place we can mine; the response stays at the boundary's
contract.

<sub>Source: <a href="examples/error-handling.md#style-01-log-04-internal-errors-do-not-leak-into-user-responses">examples/error-handling.md#style-01-log-04-internal-errors-do-not-leak-into-user-responses</a></sub>

</details>

<details>
<summary><strong>💡 Example 2 of 2</strong> — <code>examples/auth-and-secrets.md</code> § <em>sec-02-log-04-sensitive-request-material-never-appears-raw-in-logs-or-cache-keys</em></summary>

<br>

**SEC-02 / LOG-04 — Sensitive request material never appears raw in logs or cache keys**

Source: PR #2829 (RL-20251219-001)

### Avoid

Building a cache key by stringifying the entire request, then logging
that stringified value as-is for diagnostics:

```ts
const key = JSON.stringify({ url, ...requestInit });
this.loggingService.info({ msg: 'cache lookup', key });
// `key` contains the Authorization header in plaintext
```

### Prefer

Hash the stringified key before storing or logging, and assert that no
log path emits the raw `requestInit` (including headers and body):

```ts
const rawKey = JSON.stringify({ url, ...requestInit });
const key = hashSha1(rawKey); // cache key, also what we log
this.loggingService.info({ msg: 'cache lookup', key });
```

When that path also has to log a URL or method for diagnostics, log only
those fields explicitly — never the whole `requestInit`.

### Why

`Authorization` is the obvious risk, but a stringified `requestInit`
also carries cookies, session tokens, and bodies. Hashing turns the
material into an opaque identifier suitable for both lookup and
diagnostics. A test that asserts `loggingService.info` is called with
fields that do not include `Authorization` keeps the contract pinned.

<sub>Source: <a href="examples/auth-and-secrets.md#sec-02-log-04-sensitive-request-material-never-appears-raw-in-logs-or-cache-keys">examples/auth-and-secrets.md#sec-02-log-04-sensitive-request-material-never-appears-raw-in-logs-or-cache-keys</a></sub>

</details>

---

## 🌐 general › security

<a id="sec-01"></a>
### `SEC-01` Validate redirect targets

> **general** · security

**📜 Rule**\
Redirect and callback targets are strictly validated for protocol, domain, credentials, and ports.

**✅ Check**\
> Are redirect and callback targets strictly validated?

---

<a id="sec-02"></a>
### `SEC-02` Bounded sensitive fields

> **general** · security · 2 examples · ↩ `RL-20251219-001` · `RL-20260604-003`

**📜 Rule**\
Secrets, unverified payloads, encrypted material, and sensitive response fields are bounded and explicitly selected. Job IDs and externally exposed IDs are random UUIDs, not sequential. Filenames in shared object stores include a uniqueness suffix beyond a timestamp. Predicates that use `if (a && !a.flag)` must model the "doesn't exist" branch explicitly. Flags that persist request payloads to external/third-party services default to the least-retentive option (`save_if_fails`, not `save: true`).

**✅ Check**\
> Are secrets, unverified payloads, and sensitive fields bounded and explicitly selected?

<details>
<summary><strong>💡 Example 1 of 2</strong> — <code>examples/auth-and-secrets.md</code> § <em>sec-02-default-headers-come-first-caller-headers-override</em></summary>

<br>

**SEC-02 — Default headers come first, caller headers override**

Source: PR #2829 (RL-20251219-001)

### Avoid

Spreading the caller's headers first, then setting `Authorization` last
so the caller can never override the default:

```ts
function withAuth(args: TArgs): TArgs {
  return {
    ...args,
    networkRequest: {
      ...args.networkRequest,
      headers: {
        ...(args.networkRequest?.headers ?? {}),
        Authorization: `Bearer ${this.apiKey}`, // wins, always
      },
    },
  };
}
```

### Prefer

Put the default first; the caller's headers spread on top so a per-request
`Authorization` (or content-type, etc.) wins when explicitly passed:

```ts
function withAuth(args: TArgs): TArgs {
  return {
    ...args,
    networkRequest: {
      ...args.networkRequest,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(args.networkRequest?.headers ?? {}),
      },
    },
  };
}
```

### Why

The decorator's job is to add a default, not to mandate it. Callers
that genuinely need to send a different `Authorization` (a debugging
session, a follow-up call carrying a delegated token) cannot. Reversing
the spread order keeps the default in place for every normal call while
leaving an explicit override path open.

<sub>Source: <a href="examples/auth-and-secrets.md#sec-02-default-headers-come-first-caller-headers-override">examples/auth-and-secrets.md#sec-02-default-headers-come-first-caller-headers-override</a></sub>

</details>

<details>
<summary><strong>💡 Example 2 of 2</strong> — <code>examples/auth-and-secrets.md</code> § <em>sec-02-log-04-sensitive-request-material-never-appears-raw-in-logs-or-cache-keys</em></summary>

<br>

**SEC-02 / LOG-04 — Sensitive request material never appears raw in logs or cache keys**

Source: PR #2829 (RL-20251219-001)

### Avoid

Building a cache key by stringifying the entire request, then logging
that stringified value as-is for diagnostics:

```ts
const key = JSON.stringify({ url, ...requestInit });
this.loggingService.info({ msg: 'cache lookup', key });
// `key` contains the Authorization header in plaintext
```

### Prefer

Hash the stringified key before storing or logging, and assert that no
log path emits the raw `requestInit` (including headers and body):

```ts
const rawKey = JSON.stringify({ url, ...requestInit });
const key = hashSha1(rawKey); // cache key, also what we log
this.loggingService.info({ msg: 'cache lookup', key });
```

When that path also has to log a URL or method for diagnostics, log only
those fields explicitly — never the whole `requestInit`.

### Why

`Authorization` is the obvious risk, but a stringified `requestInit`
also carries cookies, session tokens, and bodies. Hashing turns the
material into an opaque identifier suitable for both lookup and
diagnostics. A test that asserts `loggingService.info` is called with
fields that do not include `Authorization` keeps the contract pinned.

<sub>Source: <a href="examples/auth-and-secrets.md#sec-02-log-04-sensitive-request-material-never-appears-raw-in-logs-or-cache-keys">examples/auth-and-secrets.md#sec-02-log-04-sensitive-request-material-never-appears-raw-in-logs-or-cache-keys</a></sub>

</details>

---

## 🌐 general › cache

<a id="cache-03"></a>
### `CACHE-03` Cached payload shape is canonical once

> **general** · cache · 2 examples · ↩ `RL-20260128-001` · `RL-20260123-001` · `RL-20260121-001` · `RL-20260114-001`

**📜 Rule**\
Cache readers and writers must agree whether payloads are raw upstream data or normalized domain data; document expiry-only caches that have no invalidation hook.

**✅ Check**\
> Did this add or change a cached datasource payload? If yes, is normalization applied exactly once and are invalidation/expiry semantics documented?

<details>
<summary><strong>💡 Example 1 of 2</strong> — <code>examples/cache.md</code> § <em>cache-03-document-expiry-only-caches-at-the-call-site</em></summary>

<br>

**CACHE-03 — Document expiry-only caches at the call site**

Source: PR #2882 (RL-20260128-001)

### Avoid

Caching upstream data with no invalidation hook and no comment explaining
that the only freshness lever is TTL:

```ts
async getEntityByOwnerV2(args: ...): Promise<...> {
  const cacheDir = this.cacheRouter.getEntityByOwnerV2CacheDir(args);
  return this.dataSource.getFromCache({ cacheDir, url, expireTimeSeconds });
}
```

### Prefer

State the cache contract inline so the next reader knows there is no
invalidation path and that staleness is bounded by the TTL only:

```ts
async getEntityByOwnerV2(args: ...): Promise<...> {
  // No upstream hook invalidates this endpoint, so the cache lives until
  // entitiesExpirationTimeSeconds expires. Match the pattern on getEntityByOwner.
  const cacheDir = this.cacheRouter.getEntityByOwnerV2CacheDir(args);
  return this.dataSource.getFromCache({ cacheDir, url, expireTimeSeconds });
}
```

### Why

Expiry-only caches look identical to invalidation-backed ones at the call
site. Without the comment, the next change touching upstream behavior tends
to assume "the cache will be flushed on the next event," ships, and the
incident report is "stale data for up to N seconds." The comment makes the
contract explicit.

<sub>Source: <a href="examples/cache.md#cache-03-document-expiry-only-caches-at-the-call-site">examples/cache.md#cache-03-document-expiry-only-caches-at-the-call-site</a></sub>

</details>

<details>
<summary><strong>💡 Example 2 of 2</strong> — <code>examples/cache.md</code> § <em>cache-03-normalize-cached-payloads-exactly-once</em></summary>

<br>

**CACHE-03 — Normalize cached payloads exactly once**

Source: PR #2864 (RL-20260123-001)

### Avoid

Normalizing in both the writer and the reader paths so the cache hit
applies the transform a second time:

```ts
// writer — fetched from API, normalized, cached
const raw = await fetch(...);
const normalized = normalize(raw);     // negates loan values
await cache.set(key, JSON.stringify(normalized));
return map(normalized);

// reader — also normalizes
const cached = JSON.parse(await cache.get(key));
const normalized = normalize(cached);  // double-negates on cache hit
return map(normalized);
```

### Prefer

Pick one side. Cache the normalized shape and trust it on read, or cache
the raw shape and normalize on every read:

```ts
// option A: cache the normalized shape, do not re-normalize
const cached = JSON.parse(await cache.get(key));
return map(cached);

// option B: cache the raw shape, normalize at every read
const raw = JSON.parse(await cache.get(key));
return map(normalize(raw));
```

### Why

Two transforms in the same pipeline are an order-dependent footgun. On a
cache miss the cached value is normalized once; on a cache hit it is
normalized twice. Loan balances flip sign, totals diverge from the items,
and the bug only reproduces under cache-warm conditions.

<sub>Source: <a href="examples/cache.md#cache-03-normalize-cached-payloads-exactly-once">examples/cache.md#cache-03-normalize-cached-payloads-exactly-once</a></sub>

</details>

---

## 🌐 general › data

<a id="data-01"></a>
### `DATA-01` Aggregates match returned items and signed values

> **general** · data · 1 example · ↩ `RL-20260113-001` · `RL-20260612-002`

**📜 Rule**\
Totals, dust filters, and aggregate fields must be computed from the same filtered items returned to clients and must preserve meaningful signed values such as debt. Pagination next/previous links derive from the clamped/normalized limit and offset actually used in the query (normalize the cursor via `setCursor`/`PaginationData`), never from the raw client cursor.

**✅ Check**\
> Did this add filtering, aggregate totals, or pagination links? If yes, are totals and links based on the items/values actually returned or queried?

<details>
<summary><strong>💡 Example</strong> — <code>examples/repositories-and-pagination.md</code> § <em>data-01-build-page-links-from-clamped-pagination-values</em></summary>

<br>

**DATA-01 — Build page links from clamped pagination values**

Source: PR #3163 (RL-20260612-002)

### Avoid

Clamping the query but building links from the raw route URL:

```ts
const limit = Math.min(args.paginationData.limit, MAX_LIMIT);
const offset = Math.max(args.paginationData.offset, 0);
const [rows, count] = await this.repository.findPage({ limit, offset });

return {
  count,
  next: buildNextPageURL(args.routeUrl, count)?.toString() ?? null,
  previous: buildPreviousPageURL(args.routeUrl)?.toString() ?? null,
};
```

### Prefer

Normalize the cursor to the values actually queried before building links:

```ts
const limit = Math.min(args.paginationData.limit, MAX_LIMIT);
const offset = Math.max(args.paginationData.offset, 0);
const [rows, count] = await this.repository.findPage({ limit, offset });

const normalizedUrl = setCursor(args.routeUrl, new PaginationData(limit, offset));
return {
  count,
  next: buildNextPageURL(normalizedUrl, count)?.toString() ?? null,
  previous: buildPreviousPageURL(normalizedUrl)?.toString() ?? null,
};
```

### Why

`buildNextPageURL` re-reads `limit`/`offset` from the URL's cursor. With a
raw `?cursor=limit=500` against a 250-row set, only 100 rows are returned
but `500 + 0 < 250` is false, so `next` is `null` and the client silently
stops paging. Links must describe the page that was actually served.

<sub>Source: <a href="examples/repositories-and-pagination.md#data-01-build-page-links-from-clamped-pagination-values">examples/repositories-and-pagination.md#data-01-build-page-links-from-clamped-pagination-values</a></sub>

</details>

---

## 📂 resilience

<a id="resilience-01"></a>
### `RESILIENCE-01` Resilience policy semantics

> resilience · 4 examples · ↩ `RL-20251215-002`

**📜 Rule**\
Circuit breakers, retries, and rate limiters classify failures intentionally (include network/timeout errors, not only HTTP 5xx); scope policy keys per-service (hostname or service base URL), not per full URL; do not record policy-blocked attempts as policy failures; distinguish absolute timestamps from durations in stale-cleanup math; and keep the error type observed by callers consistent regardless of whether the policy path is taken.

**✅ Check**\
> For new resilience code: did I list the failure types I count, scope the key per-service, leave blocked-by-policy out of the failure counter, and make sure the policy-on path throws the same error type as the policy-off path?

<details>
<summary><strong>💡 Example 1 of 4</strong> — <code>examples/resilience.md</code> § <em>resilience-01-classify-failures-and-scope-the-policy-key</em></summary>

<br>

**RESILIENCE-01 — Classify failures and scope the policy key**

Source: PR #2803 (RL-20251215-002)

### Avoid

Counting only HTTP 5xx as failures, and using the full URL as the breaker
key so each endpoint trips independently:

```ts
const circuit = circuitBreaker.getOrRegisterCircuit(url);
try {
  return await request(url, options, timeout);
} catch (error) {
  if (error instanceof NetworkResponseError && error.response.status >= 500) {
    circuitBreaker.recordFailure(circuit);
  }
  // network errors / timeouts never trip the breaker
  // separate breaker for /api/v1/owners vs /api/v1/safes — same upstream
  throw error;
}
```

### Prefer

Key by service hostname; classify network errors and timeouts as
failures alongside 5xx so the breaker reflects upstream health:

```ts
const circuitName = new URL(url).hostname;
try {
  return await request(url, options, timeout);
} catch (error) {
  const isFailure =
    (error instanceof NetworkResponseError && error.response.status >= 500) ||
    error instanceof NetworkRequestError; // timeouts, DNS, connection refused
  if (isFailure) {
    const circuit = circuitBreaker.getOrRegisterCircuit(circuitName);
    circuitBreaker.recordFailure(circuit);
  }
  throw error;
}
```

### Why

A breaker keyed per URL only opens when one endpoint of a service fails
repeatedly, while the rest of the service's endpoints keep dogpiling
the same down upstream. Counting only 5xx misses the worst real-world
failure mode — the upstream that times out or refuses connections — so
the breaker never opens against a fully unresponsive service.

<sub>Source: <a href="examples/resilience.md#resilience-01-classify-failures-and-scope-the-policy-key">examples/resilience.md#resilience-01-classify-failures-and-scope-the-policy-key</a></sub>

</details>

<details>
<summary><strong>💡 Example 2 of 4</strong> — <code>examples/resilience.md</code> § <em>resilience-01-do-not-count-policy-blocked-attempts-as-policy-failures</em></summary>

<br>

**RESILIENCE-01 — Do not count policy-blocked attempts as policy failures**

Source: PR #2803 (RL-20251215-002)

### Avoid

Recording every exception in the wrapped path, including the breaker's
own "blocked" exception, as a downstream failure:

```ts
try {
  circuitBreaker.canProceedOrFail(circuitName);
  return await request(url, options, timeout);
} catch (error) {
  if (
    (error instanceof NetworkResponseError && error.response.status >= 500) ||
    error instanceof NetworkRequestError ||
    error instanceof CircuitBreakerException // blocked, not a failure
  ) {
    circuitBreaker.recordFailure(circuitName);
  }
  throw error;
}
```

### Prefer

Treat the breaker's own block as the breaker's mechanism, not as new
evidence of upstream failure:

```ts
try {
  circuitBreaker.canProceedOrFail(circuitName);
  return await request(url, options, timeout);
} catch (error) {
  const isDownstreamFailure =
    (error instanceof NetworkResponseError && error.response.status >= 500) ||
    error instanceof NetworkRequestError;
  if (isDownstreamFailure) {
    circuitBreaker.recordFailure(circuitName);
  }
  throw error;
}
```

### Why

Counting blocked attempts as failures keeps `lastFailureTime` updating
forever, so stale-cleanup never runs and the breaker stays open across
the entire stale window even after the upstream has recovered. It also
inflates failure metrics with events that, by definition, never reached
the upstream.

<sub>Source: <a href="examples/resilience.md#resilience-01-do-not-count-policy-blocked-attempts-as-policy-failures">examples/resilience.md#resilience-01-do-not-count-policy-blocked-attempts-as-policy-failures</a></sub>

</details>

<details>
<summary><strong>💡 Example 3 of 4</strong> — <code>examples/resilience.md</code> § <em>resilience-01-stale-cleanup-multiplies-durations-not-timestamps</em></summary>

<br>

**RESILIENCE-01 — Stale-cleanup multiplies durations, not timestamps**

Source: PR #2803 (RL-20251215-002)

### Avoid

Multiplying an absolute timestamp (epoch milliseconds) by a buffer
factor when computing a stale-bound:

```ts
const staleNextAttemptTime =
  circuit.metrics.nextAttemptTime
    ? circuit.metrics.nextAttemptTime * STALE_BUFFER_FACTOR
    : Date.now();
// nextAttemptTime is e.g. 1734567890000 — multiplying by 2 lands in 2077
```

### Prefer

Multiply only the duration; add the result to the timestamp:

```ts
const bufferMs = circuit.config.timeoutMs * STALE_BUFFER_FACTOR;
const staleNextAttemptTime = circuit.metrics.nextAttemptTime
  ? circuit.metrics.nextAttemptTime + bufferMs
  : Date.now();
```

### Why

A timestamp times a constant is a date in the far future; the
`now < staleNextAttemptTime` check is then always true, so OPEN circuits
never get cleaned up and the in-memory map grows monotonically. The bug
is invisible in unit tests that mock `Date.now()` to a small value.

<sub>Source: <a href="examples/resilience.md#resilience-01-stale-cleanup-multiplies-durations-not-timestamps">examples/resilience.md#resilience-01-stale-cleanup-multiplies-durations-not-timestamps</a></sub>

</details>

<details>
<summary><strong>💡 Example 4 of 4</strong> — <code>examples/resilience.md</code> § <em>resilience-01-error-type-stays-consistent-across-the-policy-boundary</em></summary>

<br>

**RESILIENCE-01 — Error type stays consistent across the policy boundary**

Source: PR #2803 (RL-20251215-002)

### Avoid

Pulling URL parsing (or any other wrapper-only step) outside the
boundary that wraps and rethrows raw errors as the framework's typed
error:

```ts
function withCircuitBreaker(url: string, options: RequestInit) {
  if (!useCircuitBreaker) {
    return request(url, options); // wraps URL errors as NetworkRequestError
  }

  const { hostname } = new URL(url); // raw TypeError on malformed URL
  // ...
}
```

### Prefer

Keep the wrapping boundary the same regardless of the flag — either
parse inside `request()` or wrap the parse in the same `try/catch`
that produces `NetworkRequestError`:

```ts
function withCircuitBreaker(url: string, options: RequestInit) {
  try {
    const circuitName = new URL(url).hostname;
    if (!useCircuitBreaker) return request(url, options);
    circuitBreaker.canProceedOrFail(circuitName);
    return await request(url, options);
  } catch (error) {
    throw asNetworkError(error);
  }
}
```

### Why

Callers'`catch` handlers branch on the framework's typed errors. A flag
that flips a raw `TypeError` through to the caller breaks every error
handler that assumed `NetworkRequestError | NetworkResponseError`, and
the breakage only shows up when a malformed URL slips in.

<sub>Source: <a href="examples/resilience.md#resilience-01-error-type-stays-consistent-across-the-policy-boundary">examples/resilience.md#resilience-01-error-type-stays-consistent-across-the-policy-boundary</a></sub>

</details>

---
