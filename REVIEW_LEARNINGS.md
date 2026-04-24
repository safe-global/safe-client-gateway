<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Review Learnings

Conventions distilled from recurring PR review feedback. Read before opening a PR (to pre-empt common feedback), and before reviewing one (to surface patterns faster).

This file is maintained semi-automatically by the `/safe-engineering:pr-learnings` skill, which periodically scans recent PR comments, extracts repeating patterns, and merges them into the rules below without duplicating what's already there.

**Scope note:** `AGENTS.md` holds non-negotiable hard rules (pre-commit checks, commit workflow, license headers) that apply to every change. This file holds softer structural wisdom — patterns that emerged from actual reviews. Every rule here has been flagged at least once in a real PR; most have been flagged multiple times.

### Source PRs

Last analyzed 2026-04-27 · window since 2026-02-23 · PR range #2892–#3038 (74 non-bot PRs, 425 human review comments — including 13 follow-up comments on #3036 since the prior run). Next run: resume with `updated:>=2026-04-27` and skip PRs already inside this range unless they have new comments.

---

### Module & file layout

- **One NestJS module per concern.** New route families belong in a dedicated module (e.g. `fees/`), not bolted onto an existing controller. If you're tempted to add a second unrelated route to a controller, create a new module first.
- **Zod schemas live in entity files.** Do not define `z.object(...)` inline inside a verifier, repository, service, or anywhere else — put the schema and its inferred type in an `entities/*.entity.ts` alongside peer schemas. Same for inline `type X = ...` that's exported or reused: extract to an entity or types file.
- **Constants live in constants files.** JWT/crypto algorithms go in `src/datasources/jwt/jwt.constants.ts`, not redeclared at the top of a verifier. Grep for an existing home before adding a new `const FOO = '...' as const`. Don't inline repeated URLs or paths; extract to a named `const`.
- **Config tests live in `src/config/configuration.validator.spec.ts`** — not next to `configuration.ts`. Validation of required/optional env vars belongs in `src/config/configuration.schema.ts`.
- **`forwardRef(() => OtherModule)` is a code smell.** It papers over a circular dependency. Fix the module graph (move shared pieces to a third module, invert a dependency) rather than reaching for `forwardRef`.

### Naming

- **Functions that throw on failure are `assert*`.** `assertAdmin`, `assertMember`, `assertSignerAddress`, `assertAuthenticated`, `assertItemsLimitNotReached`. A function named `checkX` or `isX` that throws is a review comment waiting to happen. Getter-style helpers that throw on miss use `*OrFail` (`getAuthenticatedUserIdOrFail`, `findOneOrFail`).
- **DTOs are suffixed `Dto`.** `MemberDto`, not `Member`, when the class represents a wire/API shape.
- **Domain errors keep the `*Error` suffix** inside `domain/errors/` folders even when they extend `ForbiddenException` / `HttpException`. The folder name carries the semantics; don't mix `*Exception` and `*Error` within the same folder.
- **Test descriptions must match assertions.** `'should throw'` vs `'should not throw'`, `'upsert items'` vs `'upsert item'` — a wrong title becomes a trap later.
- **Don't repeat the class's domain in every method or field.** When a class is scoped to one thing — `Auth0TokenVerifier` only verifies one token type — methods like `verifyAndDecodeIdToken` / `getIdTokenSigningPublicKey` repeat what the class already says. Drop the redundant prefix: `verifyAndDecode` / `getSigningKey`. Same for fields (`idTokenSigningKeys` → `signingKeys`).

### Types & schemas

- **Use `Address` from `viem`**, not `` `0x${string}` ``, in both interfaces, builders, and DTO properties.
- **Reuse shared schemas** from `src/validation/entities/schemas/` before writing a new one. Existing: `AddressSchema`, `HexSchema`, `HexBytesSchema`, `NumericStringSchema`, `NullableNumericStringSchema`, `SemverSchema`, `UuidSchema`, `CoercedNumberSchema`, `DateStringSchema`, `TimezoneSchema`, `RedirectUrlSchema`, `SignatureSchema`, plus the `nullable.schema.ts` helpers.
- **Prefer Zod's built-in refinements over regex:** `z.hex()` over `.regex(/^[0-9a-f]+$/)`, `.email()` over manual email regex, etc.
- **Validate every external HTTP response with Zod.** `networkService.get/post` returns `Raw<T>`; run it through a schema before use (see `src/modules/positions/domain/positions.repository.ts` for the pattern). Do not `as` the response type.
- **Use the enum directly in `@ApiProperty`**: `@ApiProperty({ enum: MyEnum })`, not `@ApiProperty({ enum: ['A', 'B'] })` when an enum exists.
- **`.nullish()` over `.nullable().optional()`** in Zod.
- **Prefer type guards over non-null assertions.** If you have `isAuthenticated(): this is AuthenticatedAuthPayload` or `isSiwe()`, narrow with it rather than using `!` on every field.
- **Runtime narrowing via `in` checks, not casts.** `if (JobType.DELIVERY && 'chainId' in job.data)` is safer than `job.data as DeliveryJobData`.
- **Never use `any`.** `z.any()` in a schema is a review flag — use a precise type. Never `as T` a return value when the types don't line up; fix the types.
- **Generic decoder/parser calls must pass the full type you'll read.** `jwtService.decode<{ sub: string }>(token)` lies to the type system when the caller goes on to use `email`, `aud`, etc. Pass the full expected type (`decode<Auth0Token>(token)`) so consumers stay typed.

### Reuse before duplicating

- **Auth assertions:** `src/modules/auth/utils/assert-authenticated.utils.ts` and `src/modules/spaces/routes/utils/space-assert.utils.ts` already expose `assertAuthenticated`, `assertSignerAddress`, `getAuthenticatedUserIdOrFail`, `assertAdmin`, `assertMember`. Import them — don't reimplement.
- **Caching:** use `CacheFirstDataSource` for cache-on-read HTTP flows. Do not hand-roll "check cache, call API, store" logic in a new service.
- **Errors at DB write:** wrap inserts with `isUniqueConstraintError(err)` from `src/datasources/errors/helpers/` and map to the domain error (see `counterfactual-safes.repository` for the canonical 409 mapping pattern).
- **Error normalization for logs:** use `asError(err)` from `src/logging/utils.ts` instead of hand-rolling `err instanceof Error ? err.message : String(err)`.
- **Chunking / grouping:** `lodash` is already a dependency — reach for `chunk`, `uniqBy`, etc. before hand-rolling a `for` + `slice`.
- **Don't hand-roll security-critical primitives.** JWKS resolution, JWT verification, OAuth flows, key rotation, signature schemes — reach for an established library (`jwks-rsa`, `jose`, etc.) before writing your own. These libs handle caching, rotation, rate-limiting, and PEM conversion correctly; rolling your own re-creates subtle correctness bugs that have been solved upstream.

### Controllers & guards

- **Do not duplicate guard logic in controller methods.** If `@UseGuards(AuthGuard)` is applied, don't also `throw new ForbiddenException('Not authenticated')` in the body — the guard already rejected unauthenticated requests.
- **Validate every route parameter.** `@Param('chainId') chainId: string` without a `ValidationPipe(ChainIdSchema)` will be flagged. Same for `@Query(...)`. "Only one optional query param" is acceptable temporarily, but it still needs validation; when params accumulate, promote it to a dedicated endpoint.
- **Define a DTO entity for request bodies.** Don't describe the body as an inline object in `@ApiBody` — create an entity class with `@ApiProperty` fields and reference it. One source of truth for wire shape.
- **Swagger with referenced models:** declare `@ApiExtraModels(Model)` at the controller/module level once, and use `getSchemaPath(Model)` in `additionalProperties` / `items` — don't repeat `$ref` strings.
- **Read config once in the constructor**, cache as a class field, and check the field per request. Don't `configurationService.get(...)` on every incoming call.
- **Return an empty shape (`{}` / `[]`) instead of `undefined`** when a service has nothing to contribute to an aggregated response. Callers don't have to special-case it, and the response schema stays uniform.

### Authentication: SIWE and email users coexist

Users authenticate via SIWE (wallet, has `signer_address`) **or** email (no wallet). Every flow that touches user identity must handle both:

- Don't assume `authPayload.signer_address` is set. Narrow with `assertSignerAddress` or `isSiwe()` — don't write `if (!authPayload.signer_address)` checks inline.
- DB tables that store an author/owner must work for both. If you store `created_by VARCHAR(42)` (wallet address), ask yourself what happens for email users — and persist the requester's wallet at write time when the workflow requires it, instead of re-fetching per read.
- Name columns clearly: if a row has both a user FK (`creator_id`) and a wallet string (`created_by`), the reviewer will ask why — document it or collapse it.
- **Session outlives user row:** if `/users` supports DELETE, the JWT cookie lives on. Either unset the cookie in the DELETE handler or keep the user-existence check in downstream writes — don't let an FK violation become a 500.

### Database & migrations

- **Partial unique indexes for nullable unique columns:** `@Index('users_email_key', { unique: true, where: '"email" IS NOT NULL' })` (or `CREATE UNIQUE INDEX ... WHERE col IS NOT NULL` in a raw migration). A column-level `UNIQUE` on a nullable column differs subtly from the intent across DBs and forbids multiple NULLs on some.
- **Redis pipelines: validate every result.** `multi().unlink().hSet().expire().exec()` returns `[r1, r2, r3]` — check all three. Ignoring later results means "success" can mean "the first step worked but the marker was never written", which breaks `CacheFirstDataSource` staleness guards.

### Logging

- **`error` level only for actionable failures.** Business outcomes ("relay denied", "not eligible") are `warn` or `info`. Datadog monitors fire on `error`; don't page oncall for expected denials.
- **`debug` for high-frequency events.** Worker `onCompleted`, external request traces — `info` on every occurrence floods production logs.
- **Use `LogType` from `src/domain/common/entities/log-type.entity.ts`** when adding a new structured log event. Add a new enum variant rather than emitting an ad-hoc string.

### Configuration

- **Don't widen defaults to match your feature's needs.** If an env var like `AUTH0_SCOPE` defaulted to `'openid'`, don't bump it to `'openid email profile'` in the default — inject the value per environment. Defaults should be the safest, most-conservative option.
- **All config values go through `configuration.schema.ts`.** Even nullable ones — declare them as nullable there, don't skip validation. Production-required vars belong in the production-required block (e.g. `ENCRYPTION_DEK_V1_ENCRYPTED`).
- **Prefer scale-friendly shapes for versioned sets.** Instead of `ENCRYPTION_DEK_V1_ENCRYPTED`, `ENCRYPTION_DEK_V2_ENCRYPTED`, … use a single JSON record env var (`ENCRYPTION_DEKS_ENCRYPTED='{"1":"...","2":"..."}'`) parsed once. Adding v3 shouldn't require touching schema + module + configuration code.
- **Cache TTL `0` in Redis means "never expires".** Pick an explicit default (e.g. 10s) instead of `0`.
- **TTLs and timeouts go through config, not inline magic numbers.** Hardcoded constants like `60 * 60 * 1_000` for cache durations or signing-key refresh windows make tuning a code change. Read them from env via `configuration.schema.ts` so they're tunable per environment.
- **Fail fast at startup on misconfiguration.** If `captcha.enabled` without a secret key, throw in the constructor. Silent misconfiguration causes mysterious 500s later.

### Testing

- **Use builders, not inline object literals.** If the same shape appears in two tests, promote it to `__tests__/*.builder.ts` using `Builder<T>`. This applies equally to response fixtures inside a single spec — build once and assert against the builder result.
- **Generate test data with `faker`** — `faker.finance.ethereumAddress()` (wrapped in `getAddress()`), `faker.string.hexadecimal({ length: 64 })`, `faker.string.numeric({ length: 3, exclude: [existing] })`, `faker.internet.ipv4()`, `faker.date.anytime()`. Don't use `'a'.repeat(64)`, fixed addresses like `0x1234...`, or hardcoded dates unless the test specifically depends on them.
- **Share test helpers across spec files** rather than redefining `addOwnerDecoded()`, `addr()`, etc. in each spec. If two specs use the same builder, extract it.
- **Never hardcode config values in test expectations.** If the config says `limit: 5`, don't write `.expect({ remaining: 5, limit: 5 })` — read from config or use a test-scoped constant.
- **Mock the `ILoggingService` with the project's existing mock** (see other `*.repository.spec.ts`), not ad-hoc `{ info: jest.fn(), warn: jest.fn(), ... }` literals.
- **Use `FakeCacheService`** (`src/datasources/cache/__tests__/fake.cache.service.ts`) instead of a mocked `ICacheService`. It exercises real cache semantics; mocks don't.
- **`jest.resetAllMocks()` in `beforeEach` is the single reset.** Per-test `mockReset()` calls are a patch for broken setup — the real fix is usually scoping `jest.useFakeTimers()` to tests that need `setSystemTime()`, not leaving it global in `beforeAll`.
- **Scope `jest.useFakeTimers()` to tests that need it.** Module initialization under fake timers can hang timer-based init.
- **Cover the rejection paths.** Every `assert*` needs a test for the throwing branch.
- **Don't test optional config defaults.** A single `|| 'openid'` fallback isn't worth a dedicated test — if it's that trivial, the test is noise.
- **Test-only helpers (`*ForTest`) must guard against production.** If a method resets a singleton, throw when `process.env.CGW_ENV === 'production'`.

### Code style

- **DTOs: pick one initializer style and stick to it.** Either `!` assertion on every field (preferred for short classes) or constructor assignment — don't mix within the same class.
- **`public` modifier on public class methods.** Explicit beats implicit in service classes.
- **JSDoc on public and non-trivial methods.** Service/repository/util files with complex logic must document parameters and return shapes — especially anything that flows into structured logs or aggregate responses.
- **No dead code.** If a repository method isn't called, delete it. Don't add `revertToPending` alongside a generic `updateStatus` unless both have real callers.
- **Avoid redundant work in loops.** If the loop body doesn't depend on the iteration variable, pull the call out.
- **Exception filters**: NestJS's built-in handling already returns the right HTTP code for `HttpException` subclasses. Only add a custom `@Catch(...)` filter when you need to transform the response. A filter that just rethrows is noise — and if you do need one for multiple errors, use `@Catch(ErrorA, ErrorB)` rather than two filters.
- **Don't cast when the type already matches.** `return 1 as number` is a lint-review magnet.

### Security & redirect handling

- **Validate redirect URLs strictly.** Reject URLs with `username`/`password` (credential-based attacks), non-default ports, and non-https protocols. Plus match against an allow-listed domain.

### PR hygiene

- **One concern per PR.** Don't bundle unrelated lint/config tweaks or file moves into a feature PR — it balloons scope and hides real changes. If you notice drive-by fixes, split them.
- **Declare required env vars honestly in `.env.sample.json`.** If the service crashes without them, they're required — don't mark them optional to silence CI.
- **License header applies only to files you actually changed** (rule: files modified after 2026-02-16 need the SPDX header). Don't add it to files whose content you didn't touch in this PR.

### Biome / lint

- **`useImportType` is intentionally `off`.** NestJS DI relies on TypeScript's emitted runtime metadata; `import type` strips a class from the runtime and breaks providers. Don't "fix" this rule back on.
