<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Code Conventions

Use this guide before making code changes. It is intentionally CGW-local:
existing modules, tests, docs, and review history are the source of truth.

## Change Scope

### CHANGE-01 Prefer The Smallest Correct Change

Use the simplest code that satisfies the expected behavior and keep the
changed surface area small. Local implementation detail is usually better than
global or module-level indirection until reuse is real.

Allowed expansion:

- It reduces current complexity.
- It creates a real external or module boundary.
- It has multiple consumers.
- It has independent lifecycle, cache, or connection state.
- It is needed for independent testability.

Evidence: Auth0 JWKS factory review, repeated PR hygiene comments.

### CHANGE-02 Keep PRs To One Concern

Do not bundle unrelated docs, config, formatting, generated output, dependency,
or cleanup changes into a feature PR. Split drive-by improvements unless they
are required for the requested behavior.

Evidence: Auth0 PR AGENTS.md comment, tooling migration review comments.

### CHANGE-03 Preserve Behavior During Tooling Migrations

Lint/format migrations must preserve existing behavior, reviewer guardrails,
and contributor docs. If a previous tool rule has no direct replacement, record
the gap or replacement rationale in the PR.

Evidence: Biome migration review comments about missing restricted imports,
lost ESLint rules, stale docs, and intentional `useImportType` behavior.

### CHANGE-04 Version External Contracts Deliberately

Do not change a released route path, parameter location, response shape, or
required field without an explicit compatibility decision. Released breaking
changes need a new endpoint version or a backward-compatible transition. WIP
or unreleased endpoints may change in place, but the PR description must say
that clearly.

Evidence: service-key path/query review, gas-limit compatibility review,
address-poisoning V3 review.

## Module And Layering

### MOD-01 Use One Module Per Product Or API Concern

New route families belong in a dedicated module or route submodule, not bolted
onto an unrelated controller. Existing special shapes such as `safe-shield`,
`portfolio/v1`, and `csv-export/v1` are precedent only for similar complexity.

Evidence: review learnings, module inventory.

### MOD-02 Keep Persistence Workflows Behind Repositories

Route services should orchestrate product behavior and identity flow, not know
how database creation, uniqueness, email persistence, or race handling interact.
When a use case is fundamentally a persistence workflow, expose one repository
method that owns the sequence and keep helper methods private unless another
consumer exists.

Evidence: PR #3066 OIDC email persistence review.

### MOD-03 Avoid Single-Use DI Abstractions

Do not introduce providers, interfaces, factories, injection tokens, or helper
files for implementation details used by one class only. Keep construction
local when direct code is shorter and easier to review.

Evidence: PR #3036 Auth0 JWKS factory review.

### MOD-04 Expose Interfaces Only For Real Consumers

Repository and datasource interfaces are public contracts. Do not add methods
to an interface when the behavior is only a private implementation detail of
one repository or service.

Evidence: PR #3066 repository interface review.

### MOD-05 Avoid Expanding Module Cycles

`forwardRef(() => OtherModule)` is an accepted local reality in some older
auth/users/spaces paths, not a default design tool. Try to simplify ownership
or move shared pieces before adding a new cycle.

Evidence: module inventory and review learnings.

### MOD-06 Keep Route Services Behind Repositories

Route services should call repositories and route helpers, not low-level
datasources directly. If route logic needs external API data or database rows,
put validation, batching, fallback behavior, and datasource error mapping
behind a repository boundary first.

Evidence: review learnings, module inventory, address-book and balances
reviews.

## Naming, Reuse, And Style

### NAME-01 Keep Names Honest And Scoped

Names should describe behavior, not implementation history. Throwing helpers
use `assert*` or `*OrFail`; boolean predicates used for branching should not
throw. DTO classes use the `Dto` suffix, domain errors use the `*Error` suffix,
test names match their assertions, and methods should not repeat the class
domain when the class already scopes the behavior.

Evidence: review learnings.

### REUSE-01 Reuse Local Helpers And Canonical Homes

Before hand-rolling helper code, grep for the CGW home first. Shared constants
belong in existing constants files, cache-on-read HTTP flows should use
`CacheFirstDataSource`, log normalization should use `asError`, and grouping or
chunking should use existing dependencies such as `lodash` where they already
fit.

Evidence: review learnings.

### STYLE-01 Keep Public Code Explicit And Maintained

Use explicit `public` on public service/repository methods, document public or
non-trivial logic with concise JSDoc, and delete dead methods or unreachable
fallbacks instead of keeping unused extension points.

Evidence: review learnings.

## Types, DTOs, And Schemas

### TYPE-01 Use Project Types And Shared Schemas

Use `Address` and `Hex` from `viem` where those are the actual values. Reuse
shared schemas from `src/validation/entities/schemas` before creating new
address, hex, numeric, UUID, date, timezone, redirect URL, or signature
validation. Prefer Zod built-ins and local nullable helpers over ad-hoc regexes
or chained `.nullable().optional()`.

Evidence: review learnings and PR #3061 encoder return-type comment.

### TYPE-02 Put Schemas With Entities

Do not define reusable `z.object(...)` schemas inline inside verifiers,
repositories, services, or controllers. Put schemas and inferred types in an
entity file or `entities/schemas` folder, depending on size and reuse.

Evidence: PR #3036 Auth0 token/JWKS schema review, review learnings.

### TYPE-03 Validate External And Queued Data Before Use

Validate every external HTTP response, token claim shape, queued job payload,
and externally supplied config string with Zod or a dedicated schema before it
drives behavior. Do not rely on runtime escaping or downstream services as the
first validation boundary.

Evidence: PR #3039 SES email job/config review, PR #3065 Auth0 claim tests.

### TYPE-04 Keep DTO Contracts Exact

DTO classes must represent the actual wire shape. Field optionality,
nullability, enum source, and implemented domain picks must match what the API
returns. Do not expose extra user/status/wallet/email fields without a product
decision.

Evidence: PR #3037 member email DTO review, review learnings.

### TYPE-05 Type Parsers For The Full Shape Read

Decoder/parser calls should use the full type the caller reads. Do not decode
`{ sub: string }` and then consume email, audience, expiry, or other claims.

Evidence: PR #3036 and PR #3065 Auth0 verifier reviews.

### TYPE-06 Avoid Casts, `any`, And Type Drift

Do not paper over mismatches with `as`, `unknown`, or `any`. If package types
are incomplete, add a runtime assertion or a narrow adapter that fails loudly
when upstream data drifts.

Evidence: PR #3061 signer factory ABI review, review learnings.

## Auth And User Data

### AUTH-01 Reuse Auth Assertions And Predicates

Use existing auth helpers such as `assertAuthenticated`,
`assertSignerAddress`, `getAuthenticatedUserIdOrFail`, `assertAdmin`,
`assertMember`, and non-throwing predicates for branching. Do not catch
throwing assertions to implement normal control flow.

Evidence: review learnings, module inventory.

### AUTH-02 Support Wallet And Email Users

Identity flows must handle SIWE users with wallet addresses and OIDC/email
users without wallet addresses. Do not assume `signer_address` exists unless
the code has narrowed to a wallet-authenticated user.

Evidence: review learnings, OIDC/member-email PRs.

### AUTH-03 Prefer Proven Auth/Crypto Libraries

Do not hand-roll JWKS resolution, JWT verification, OAuth flows, key rotation,
or signature primitives when a maintained library covers the behavior. Keep
single-use library construction local to the verifier unless reuse appears.

Evidence: PR #3036 Auth0 JWKS review.

### AUTH-04 Be Deliberate About Email Exposure

Email is user data. Route responses must intentionally decide when email is
returned, redacted as `null`, or omitted. Apply the same rule to every endpoint
returning the same domain object unless a product exception is explicit.

Evidence: PR #3037 member email review.

## Database And State

### DB-01 Match Uniqueness To Lifecycle

Unique constraints must match the business lifecycle. Nullable unique fields
need partial indexes where appropriate, and rows with terminal states should
not accidentally block future submissions unless that is intentional.

Evidence: review learnings.

### DB-02 Keep Multi-Step State Changes Atomic

Approval/rejection/status flows should use transactions or atomic conditional
updates. Avoid "write state, run side effect, compensate later" sequences
without an explicit recovery story.

Evidence: review learnings.

### DB-03 Avoid Redundant Persistence Work

Do not perform a read only to learn what a guarded update already encodes.
Short-circuit known no-op paths, avoid redundant DB trips in hot flows, and
remove dead fallback branches when they cannot be reached.

Evidence: PR #3066 email persistence review.

### DB-04 Map DB Errors At The Write Boundary

Repositories should map unique-constraint and expected persistence failures to
domain errors at the write boundary. Callers should not need to understand raw
database error codes.

Evidence: review learnings, PR #3066.

### DB-05 Keep DB Schema, Entities, And Runtime Assumptions Together

When adding persistence, update migrations, TypeORM entities, domain schemas,
repository tests, entity registration, indexes, rollback assumptions, enum
transformers, and timestamp behavior as one contract. Avoid redundant indexes,
unbounded columns, silently swallowed `orIgnore` errors, and entity fields that
do not match what Postgres or TypeORM actually returns.

Evidence: counterfactual-safes and address-book migration reviews, encrypted
field review learnings.

## Cache And External State

### CACHE-01 Validate Multi-Step Cache Operations

Cache writes and Redis pipelines are part of the state transition. Validate
every meaningful result from `multi().exec()` and similar batches; do not treat
the first successful command as proof that markers, TTLs, or hashes were also
written.

Evidence: review learnings.

### CACHE-02 Make Cache Keys And Expiry Semantics Unambiguous

Cache keys must uniquely identify the upstream endpoint and parameters. Avoid
ambiguous string concatenation, normalize intentional case differences, bound
in-memory caches, and test key builders and TTL refresh behavior when a change
can collide, never expire, or leave stale invalidation markers.

Evidence: portfolio cache collision review, Redis invalidation reviews,
derived-key cache review.

## Configuration And Dependencies

### CONFIG-01 Keep Defaults Safe And Generic

Defaults should be conservative and OSS-generic. Do not widen scopes or use
Safe-branded defaults unless the product requirement explicitly calls for it.

Evidence: PR #3036 Auth0 scope review, PR #3039/3063 email sender defaults.

### CONFIG-02 Validate Config At Startup

All config values go through `configuration.schema.ts` or a dedicated schema.
Feature-flag-dependent required values should fail startup validation, not
throw later from `getOrThrow` during a request or worker job. Config validation
tests belong in `src/config/configuration.validator.spec.ts`.

Evidence: PR #3039 SES config review, review learnings.

### CONFIG-03 Make Tunables Configurable

TTLs, timeouts, cache windows, refresh windows, and operational knobs should be
configuration values rather than inline magic numbers. Request-invariant config
should be read once during construction and cached as a class field.

Evidence: PR #3036 JWKS cache review, review learnings.

### CONFIG-04 Pin Runtime Dependencies Exactly

Runtime dependencies should be pinned exactly unless the repo has an explicit
reason to allow semver drift. Version guards in code do not replace exact
package pinning.

Evidence: PR #3061 safe-modules-deployments review, PR #3036 jose review.

### CONFIG-05 Keep Tooling Versions And Env Metadata Single-Sourced

Toolchain versions, Docker build args, workflow action refs, and sample env
metadata should have one source of truth. Pin CI actions to immutable SHAs where
the repo already does so, pass version files into Docker builds, and make
`.env.sample.json` required flags match runtime `getOrThrow` and startup
validation.

Evidence: Bun workflow review, env sample requiredness reviews, CAPTCHA and
relay config reviews.

## Controllers And Routes

### ROUTE-01 Keep Controllers At The HTTP Boundary

Controllers handle route decorators, guards, pipes, Swagger, and translation to
service calls. Do not duplicate guard logic in controller bodies.

Evidence: review learnings.

### ROUTE-02 Validate Route And Query Inputs

Every route parameter, query parameter, and request body needs a schema or DTO
validation boundary. Inline object descriptions in Swagger are not enough; use
DTO entities and shared `@ApiExtraModels`/`getSchemaPath` references instead of
duplicating schema strings.

Evidence: review learnings.

### ROUTE-03 Return Stable Empty Shapes

Return `{}` or `[]` instead of `undefined` when a service has nothing to
contribute to an aggregate response.

Evidence: review learnings.

## Security-Sensitive Inputs

### SEC-01 Validate Redirect Targets Strictly

Redirect URLs and similar callback targets must be validated against the full
attack surface: protocol, allow-listed domain, credentials, and unexpected
ports. Do not rely on a partial string or domain check.

Evidence: review learnings.

### SEC-02 Bound Sensitive Data And Unverified Input Use

Unverified tokens, secrets, API keys, encrypted material, and user data should
have narrow lifetimes, bounded caches, and explicit trust boundaries. Do not
log secrets or pass raw upstream/user payloads through to queues, DTOs, or
errors unless the exact fields are intentionally selected and validated.

Evidence: OIDC logout review, Gelato API key review, push notification payload
review, encrypted derived-key cache review.

## Testing

### TEST-01 Use Existing Builders And Fakes

Use builders, `faker`, and existing fakes such as `FakeCacheService`. Do not
repeat inline objects or ad-hoc mocks when the repo has a helper pattern.

Evidence: review learnings.

### TEST-02 Test At The Right Layer

Use e2e tests for externally observable API behavior. Do not reach into the DB
from an e2e test to force internal state when a unit or service test would
target the rule more directly.

Evidence: PR #3037 member email test review.

### TEST-03 Avoid Mocking Internal Query Builders

Prefer repository-boundary mocks or integration tests over chained
`createQueryBuilder` mocks. Query-builder mocks couple tests to implementation
details and often only test mock wiring.

Evidence: PR #3066 users repository spec review.

### TEST-04 Cover Security And Negative Paths

Token verifiers, auth flows, config validation, redirect validation, and
security-sensitive parsers need explicit negative-path tests: wrong issuer,
wrong audience, expired token, missing required claims, malformed claims, and
unexpected upstream errors.

Evidence: PR #3065 Auth0 verifier review.

### TEST-05 Keep Test Lifecycle Cleanup Minimal

Use `jest.resetAllMocks()` or focused `mockRestore()` where needed. Do not add
global restore/reset calls because a mock was coupled to app initialization;
fix the setup lifecycle instead.

Evidence: PR #3065 and PR #3066 test cleanup reviews.

### TEST-06 Fixtures Must Fail Loudly

Do not silently skip core test cases because a deployment or supported-chain
fixture is absent. Choose a supported chain in setup and fail loudly if the
required deployment is missing.

Evidence: PR #3061 signer factory relay tests.

### TEST-07 Cover Routing And Precedence Pipelines

When a feature changes which implementation, relayer, mapper, verifier, queue,
or downstream adapter is selected, add a test that exercises the full selection
pipeline. Unit tests for the new branch are not enough if precedence between
existing branches can change behavior.

Evidence: PR #3061 signer factory relay routing review.

### TEST-08 Keep Test Names And Data Honest

Test descriptions should match the assertion, and generated data should reflect
realistic valid inputs unless the case depends on a specific literal. Avoid
fixed addresses, dates, or repeated strings when `faker` or a builder better
expresses the intent.

Evidence: review learnings.

### TEST-09 Cover Edge Cases, Side Effects, And Determinism

When behavior promises logging, cache invalidation, ordering, batching,
fallbacks, auth membership, or DB side effects, add tests that would fail if
that promise regressed. Include duplicate inputs, equal timestamps, missing
fixtures, production/default branches, failure branches, and non-order-based
assertions for concurrent work.

Evidence: address-poisoning ordering review, cache invalidation tests,
auth redirect default-branch review, push notification N+1 review.

## Performance And Batching

### PERF-01 Batch, Bound, And Reuse Work

Avoid N+1 database/API calls, repeated reads already performed by a guarded
write, unbounded route limits, and redundant loops over the same data. Batch
related lookups, cache repeated upstream calls within a request, select only
needed fields, cap user-controlled limits, and keep independent I/O parallel
when dependencies allow it.

Evidence: spaces safe-count review, push notification delegate review,
address-book mapper review, safe overview and chains pagination reviews.

## Logging And Observability

### LOG-01 Match Log Level To Actionability

Use `error` only for actionable failures. Expected denials, business outcomes,
and high-frequency worker lifecycle events should be `warn`, `info`, or
`debug` depending on operational value.

Evidence: PR #3039 email worker review, review learnings.

### LOG-02 Avoid Noisy Success Logs

Do not add success logs inside hot verification/auth paths unless they carry
operational value that cannot be derived elsewhere.

Evidence: PR #3036 Auth0 verifier/repository reviews.

### LOG-03 Justify New Telemetry Cost

Observability changes should justify operational cost before landing. Do not
add paid tracing, high-cardinality telemetry, or noisy instrumentation unless
the expected debugging/on-call value is worth the cost.

Evidence: closed-unmerged PR #3022 Datadog APM trace decision.

### LOG-04 Use Structured Log Helpers And Types

When adding structured log events, use `LogType` rather than ad-hoc strings.
When normalizing caught values for logs, use `asError` instead of custom
`instanceof Error` branches.

Evidence: review learnings.

## PR Readiness

### PR-01 List New Abstractions Before Opening A PR

For every new file, provider, interface, helper, factory, injection token, or
module export, be able to explain why direct local code was insufficient. If
the answer is weak, inline it.

Evidence: Auth0 JWKS review learning.

### PR-02 Keep Docs And Samples Aligned

When behavior, defaults, tooling, or setup changes, update docs and sample env
metadata in the same PR unless the file is intentionally generic or vendored.

Evidence: PR #3030 Biome docs review, PR #3065 Auth0 docs review.
