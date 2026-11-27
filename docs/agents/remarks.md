<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Recurring Review Remarks

A catalog of the review comments that come up over and over in this repo. Every entry below was drawn from real review feedback on merged or open PRs — the "Spotted in" field cites where. The catalog exists so a change can preempt the remark instead of earning it.

This file is a lookup table, not a rule source. Where a remark restates a rule another guide owns, the entry links there and does not re-argue it; the value of the entry is that it names the *shape the mistake takes in a diff*.

## Entry schema

```
### R-NNN: <short name>
**Pattern:** what to look for in a diff
**Why it's bad:** 2–3 sentences
**Corrected form:** code
**Spotted in:** PR references
**Status:** active | solved-by-biome | retired
```

`active` — still caught by humans. `solved-by-biome` — a biome rule now fails it, so the entry is kept as historical context only. `retired` — the underlying convention changed; kept so an old review comment can be understood.

Numbers are permanent. A retired entry keeps its number; new entries take the next free one.

## Adding an entry

A remark earns an entry once it has been raised on **two different PRs by any reviewer, or twice on one PR against different code**. One-off feedback stays in that PR. When adding one: take the next free `R-NNN`, cite the PRs, and — if the remark belongs to a domain another guide owns — link that guide's rule instead of restating it. When a biome rule starts catching an entry, flip its status to `solved-by-biome` and name the rule; do not delete the entry.

---

## Tests

### R-001: Redundant `as unknown` in a mock cast

**Pattern:** `as unknown as MockedObject<T>`, or any double cast in a spec file, where a single `as MockedObject<T>` compiles.

**Why it's bad:** the second cast is noise that reads as if the two types were genuinely incompatible, and it trains the next author to reach for `as unknown as` reflexively — including in production code, where `best-practices.md`'s parse-don't-assert rule forbids it. This is the single most frequently repeated remark in the repo's review history.

**Corrected form:**

```ts
// Don't
const loggingService = { debug: vi.fn() } as unknown as MockedObject<ILoggingService>;
// Do
const loggingService = { debug: vi.fn() } as MockedObject<ILoggingService>;
```

**Spotted in:** #3247 ("nit: please ask your Claude to memo that there is no need to cast to unknown"), #3241, #3196 (three separate comments), #3214, #3392 ("remove unknown :)", twice), #3420 ("then we dont need to do `as unknown as IBillingApi,`"), #3451 ("idk why unknown is always added, it is not needed"), #3595 ("when other tests here use a simpler `as MockedObject<...>)`?").
**Status:** active

### R-002: `as never` to satisfy a mock signature

**Pattern:** `vi.mocked(x).mockResolvedValue(y as never)`, or any `as never` in a spec.

**Why it's bad:** `never` silences the type error without describing anything — the mock now type-checks against a type no value can inhabit, so the spec stops verifying that the double matches the interface it stands in for. Typing the double as `MockedObject<T>` gets the same result while keeping the check.

**Corrected form:**

```ts
// Don't
mockRepository.getSpace.mockResolvedValue(space as never);
// Do
const mockRepository = { getSpace: vi.fn() } as MockedObject<ISpacesRepository>;
mockRepository.getSpace.mockResolvedValue(space);
```

A `Raw<T>` payload returned by a mocked network call goes through `rawify()` instead of a cast:

```ts
// Don't
fetchClientMock.mockResolvedValueOnce({ status: 200, data: {} as never });
// Do
fetchClientMock.mockResolvedValueOnce({ status: 200, data: rawify(campaign) });
```

**Spotted in:** #3247 ("a bit weird - why do we cast to `never`?", "looks like there are a bunch of places where it uses `never`"), #2831 ("Why are we casting the object? I see it happening further down as well.", "We could use the helper method `rawify`").
**Status:** active

### R-003: Mocking the configuration service instead of using the fake

**Pattern:** a hand-rolled `{ getOrThrow: vi.fn() }` double for `IConfigurationService` in a spec.

**Why it's bad:** `FakeConfigurationService` already exists and behaves like the real thing — including throwing on a missing key — so a hand-rolled double both duplicates it and loses that behavior, letting a spec pass with configuration the application would reject at boot. Having both idioms in the tree also leaves the next author guessing which one is current.

**Corrected form:**

```ts
// Don't
const configurationService = { getOrThrow: vi.fn() } as MockedObject<IConfigurationService>;
// Do
const fakeConfigurationService = new FakeConfigurationService();
fakeConfigurationService.set('spaces.maxSpaceCreationsPerUser', faker.number.int());
```

**Spotted in:** #3196 ("why not use `FakeConfigurationService`?"), #3220 ("nit: what if we use fakeConfigService instead of mocked one?"), #3196 ("we should update Agents.md to tell AI to use fakeConfigService instead of mocking it").
**Status:** active — see `testing.md` for the mocking conventions this belongs to.

### R-004: Literal test data instead of faker

**Pattern:** a hard-coded string, number, or address as a spec input, where nothing about the assertion depends on that exact value. The same remark covers a whole entity written out by hand — an object literal, a local factory, or a partial object cast to the type (`{ id } as User`) — where a builder exists or the shape is built more than once.

**Why it's bad:** a literal input makes a passing test ambiguous — it may pass because the code is right, or because the code happens to special-case that value. Randomizing the input is what makes the assertion prove the general case. The exceptions are values the assertion is *about*: enum members, taxonomy strings, and boundary values.

**Corrected form:**

```ts
// Don't
const roles = ['SERVICE_ACCESS'];
const ttl = 3600;
// Do
const role = faker.string.alphanumeric();
const ttl = faker.number.int({ min: 1, max: 86_400 });
```

A hand-written entity becomes a builder call; a shape with no builder yet gets one beside its entity:

```ts
// Don't
const member = memberBuilder().with('user', { id } as User).build();
// Do
const member = memberBuilder().with('user', userBuilder().with('id', id).build()).build();
```

**Spotted in:** #3217 (five separate comments: "We should use `faker`", "Should be a random string", "We should use a random number", "Nit: We should use `faker` here as well"), #3157, #3329 ("Since we’re mocking the responses, we should be able to make the `chainId` random."), #2884 ("could we please create a builder as we have for SafeSchema?"), #3375 ("Could we use `UserBuilder` here?", "Here as well, we should use a `UserBuilder`?"), #3564 ("W should use faker for new props in this file"), #3613 ("It would be nice to pick from `ExperimentalFeatures` with faker, as the builder already does.").
**Status:** active — `testing.md` owns the builders-and-faker rule; this is the shape it gets violated in.

### R-005: Asserting on `.mock.calls` instead of the matchers

**Pattern:** `expect(fn.mock.calls[0][0]).toBe(...)`, or indexing into `.mock.calls` at all.

**Why it's bad:** an index-based assertion says nothing about what the call *meant*, and its failure output is a raw array diff rather than a named expectation. `toHaveBeenCalledWith` / `toHaveBeenNthCalledWith` read as the intent and fail with a readable message.

**Corrected form:**

```ts
// Don't
expect(blockaidApi.scanAddressBulk.mock.calls[0][0]).toEqual(firstBatch);
// Do
expect(blockaidApi.scanAddressBulk).toHaveBeenNthCalledWith(1, firstBatch);
```

**Spotted in:** #3214 ("instead of `.mock.calls` please try to use `.haveBeenCalledWith()` its much easier to read"), #3214 (follow-up: switched to `toHaveBeenNthCalledWith` with the exact batch slices).
**Status:** active

### R-006: Asserting that *an* error was thrown, not *which*

**Pattern:** `await expect(promise).rejects.toThrow()` with no argument.

**Why it's bad:** the bare form passes for any rejection, including a `TypeError` from a typo on the line under test — so it can keep passing after the behavior it was written to pin has broken. Naming the error or the message is what makes it a regression test.

**Corrected form:**

```ts
// Don't
await expect(service.mintToken()).rejects.toThrow();
// Do
await expect(service.mintToken()).rejects.toThrow(new UnauthorizedException('Invalid nonce'));
```

**Spotted in:** #3217 ("Nit: We should check the exact error here.").
**Status:** active

### R-007: Comments restating what the test already says

**Pattern:** `// Arrange` / `// create a space and assert it exists` above code that reads identically. The same remark lands outside specs: a comment above production code or on a type field that paraphrases what it annotates. So does one rationale copied to every file it touches (migration, entity, DTO, service).

**Why it's bad:** a comment that paraphrases the next line has to be maintained alongside it and is wrong the moment it isn't, while adding nothing a reader of the line does not already have.

**Corrected form:** delete the comment; if the test needs explanation, the `it(...)` description is the place for it. In production code, a comment proposed to explain hard-to-follow code is a cue to restructure the code instead — #2824 replaced one with a typed `reduce<ThreatIssues>`. A rationale several sites share is written once, at one of them.

**Spotted in:** #3290 (three comments: "I think this comment is bit redundent", "I think we don't need to explain explicitly", "here the same"), #2831 ("Nit: The comment is redundant."), #2824 ("what do you think about refactoring it like this and removing the comment"), #3526 ("This comment could be removed IMO"), #3450 ("The comment is repeated at multiple places. Will be hard to detect and update"), #3744 ("This comment doesn't add any value XD.").
**Status:** active

### R-008: Tests that assert the framework, not the behavior

**Pattern:** a spec that checks a config object has the keys it was literally just given, or that a Zod schema rejects the wrong type.

**Why it's bad:** the assertion restates the source rather than constraining it, so it can never fail for a reason anyone cares about while still costing maintenance on every refactor. "they dont bring much value" (#3157) is the review outcome.

**Corrected form:** assert the behavior that depends on the config or the schema, not the declaration itself.

**Spotted in:** #3157 ("dont hurt to have but also not sure we really need these tests :) they dont bring much value", "dont trust everything claude says :)").
**Status:** active

### R-032: Test file suffix that doesn't match the layer it runs in

**Pattern:** a `*.spec.ts` that boots a controller's Nest module, or a `*.e2e-spec.ts` whose upstream calls are all mocked — including new coverage added only as e2e.

**Why it's bad:** #3107's and #3393's e2e specs would never have run on a PR, and #2884's module-booting suite sat in the unit project. Nothing failed; the coverage just wasn't where the reader thought it was.

**Corrected form:** #3393 renamed `policies.e2e-spec.ts` to `policies.integration.spec.ts`, #3107 renamed its controller spec "from e2e to integration so CI picks it up", and #2884's `owners.controller.v3.spec.ts` landed as `owners.controller.v3.integration.spec.ts`.

**Spotted in:** #2884 ("I would suggest to rename owners.controller.v3.spec.ts to be owners.controller.v3.integration.spec.ts as it is not unit but rather integration test suite"), #3107 ("becuase it is e2e test (and not integration) it wil not be run as part of CI but only on demand"), #3393 ("I think this test is more of an integration than e2e as you are mocking network calls").
**Status:** active — `testing.md`'s "Test taxonomy" rule owns this.

## Types

### R-009: `unknown` in a public signature where a generic belongs

**Pattern:** a datasource or service method taking or returning `unknown`, with the caller casting or re-parsing at every call site.

**Why it's bad:** `unknown` on a boundary pushes the type obligation onto every caller, so the same parse gets written N times and drifts. A type parameter keeps the obligation at the one place that knows the shape.

**Corrected form:**

```ts
// Don't
async post(url: string, body: unknown): Promise<unknown>;
// Do
async post<T>(url: string, body: object): Promise<Raw<T>>;
```

**Spotted in:** #3228 ("anyway to avoid `unknown` type?", "same here, could we have generic instead of unknown?"), #3220 ("any way we could avoid `unknown` type?", "also here, could be nice to not have `unknown`").
**Status:** active

### R-010: Optional and nullable used interchangeably

**Pattern:** a DTO field declared `field?: T | null` where the schema allows only one of the two, or `@ApiProperty({ nullable: true })` on a field the type says is optional. The reverse also comes up: `@ApiPropertyOptional` on a field that is always sent and only ever `null`.

**Why it's bad:** `undefined` (key absent) and `null` (key present, empty) are different wire payloads, and the generated OpenAPI document is what clients build against — so a mismatch here is a contract bug that no test in this repo catches. "nullable is not optional, and i dont see `undefined` allowed on these values anywhere" (#3223).

**Corrected form:**

```ts
// Don't
@ApiProperty({ nullable: true })
safe?: Address | null;
// Do — pick the one the schema allows, and annotate it accordingly
@ApiPropertyOptional({ type: String })
safe?: Address;
// Do — a key that is always present but may be null
@ApiProperty({ type: Relayer, nullable: true })
relayer: Relayer | null;
```

**Spotted in:** #3223 ("so its optional and nullable? something doesnt add up here", "if its optional it should be `safe?:...`", "could we please check the swagger annotations"), #3200 ("lets mark optional fields as `@ApiPropertyOptional`"), #3105 ("According to schema I dont see `undefined` allowed"), #3163 ("is it optional? if so should be `targetUser?:`").
**Status:** active — `api-dtos-and-validation.md` owns the schema/DTO pairing.

### R-011: A new schema where a shared one exists

**Pattern:** an inline `z.string().regex(...)` or a fresh schema object that duplicates something already exported from a shared schemas module. The same remark covers a generic shared schema used for a domain value that has its own — `NumericStringSchema` on a `:chainId` param where `ChainIdSchema` exists.

**Why it's bad:** two schemas encoding one rule drift the moment only one is fixed — and the shared ones already carry the edge cases a fresh regex will miss (`NonNegativeNumericStringSchema` was itself found to accept leading zeros in #3200, a bug fixed once in the shared schema rather than in each copy).

**Corrected form:** import the existing schema; if it is nearly right, generalize it in place and rename it rather than forking it. Use the domain-named schema even while it is an alias of a generic one, so tightening it later reaches every caller.

**Spotted in:** #3200 ("`NonNegativeNumericStringSchema` wont work here?"), #3269 ("Might make sense to re-use `PaymentLinkMetadataSchema` (with a more generic name) here and other places?"), #2824 ("If it's an `eth` address we can use `HexSchema`"), #3454 ("We should use `ChainIdSchema`").
**Status:** active

### R-012: String-literal unions instead of a `const` array

**Pattern:** a Zod enum written as inline literals, with the same literals re-typed in the test builder or in the DTO's `@ApiProperty({ enum: [...] })`. The same remark covers literals re-typed where an exported value set already exists: `operation: 0 | 1` beside `Operation`, or a DTO description that spells out the names in `DISALLOWED_TAG_NAMES`.

**Why it's bad:** the schema and the builder end up with two independent lists, so adding a member to one silently leaves the other stale. A single `as const` array feeds both — `z.enum([...X])` and `faker.helpers.arrayElement(X)` — so a new member reaches the tests for free.

**Corrected form:**

```ts
// Do
export const SubscriptionStatus = ['active', 'past_due', 'canceled'] as const;
export const SubscriptionSchema = z.object({ status: z.enum([...SubscriptionStatus]) });
// and in the builder
status: faker.helpers.arrayElement(SubscriptionStatus),
// and in the DTO
@ApiProperty({ enum: SubscriptionStatus })
```

**Spotted in:** #3228 (the `SubscriptionStatus` suggestion, "maybe we could set them as `const` to avoid using literals?"), #2854 ("Can we make it an actual enum instead of hard coding it?", "it should be an actual enum and reused in multiple places"), #3564 ("We should read from the `Operation` enum."), #3619 ("dynamically derive the disallowed names from DISALLOWED_TAG_NAMES here and all other descriptions").
**Status:** active

### R-033: `string` where the project already has the type

**Pattern:** an address, chain id or UUID typed `string`, or a type written out field by field, where `Address`, `UUID`, an existing entity, or `z.infer`/`z.input` of a schema already defines it. Builder row types count too.

**Why it's bad:** #3564's `SafenetSafeTransaction` and its builder re-declared `BaseMultisigTransaction` field by field, and #3531's member `address` was a plain `string` beside typed siblings.

**Corrected form:**

```ts
// Don't
export type SafeRef = { chainId: string; address: Address };
// Do
export type SafeRef = z.infer<typeof SafeRefSchema>;
```

**Spotted in:** #3531 ("Should we use Address from viem instead of string here?", then "This could also use Address from viem" and "Same here :)" on two more files), #3391 ("Nit: Would be nice to infer the type from the global `ChainIdSchema`.", "Nit: Same here, we could infer the type from `AddressSchema`"), #3392 ("Nit: Can we read it from the schemas?"), #3564 ("Why are we not using the current types we have? We have Safe TX type."), #3117 (a suggestion replacing `uuid: string` with `uuid: UUID`).
**Status:** active — `best-practices.md`'s "The project's type, not `string`" rule owns this, with `api-dtos-and-validation.md`'s "Domain types from Zod" rule for the `z.infer` side.

### R-037: A parameter typed wider than what the method handles

**Pattern:** a parameter whose type admits values the method does not handle: `ordering?: string` for a closed set of four values, a `FeatureKey` on a method that only checks `grant.enabled`, a `QueryDeepPartialEntity<Space>` where the interface declares `Partial<Pick<Space, 'name' | 'status'>>`.

**Why it's bad:** #3454's `assertFeatureGranted` would have admitted a metered feature with an exhausted quota, and #3163's `typeof updatePayload.name === 'string'` checks existed only because the parameter admitted more than the method used.

**Corrected form:**

```ts
// Don't
assertFeatureGranted(args: { spaceId: Space['id']; featureKey: FeatureKey }): Promise<void>;
// Do
assertFeatureGranted(args: { spaceId: Space['id']; featureKey: BinaryFeature }): Promise<void>;
```

**Spotted in:** #3550, #3454, #3163.
**Status:** active — `best-practices.md`'s "Parameters as narrow as what the method handles" rule owns this.

### R-038: A variant or field nothing reads

**Pattern:** a result union whose variants every reader handles the same way, or a field added to a returned shape with no consumer that acts on it.

**Why it's bad:** in #3199 a `degraded` result and a missing key both fell through to `serveDegradedBalance`, so the union told readers nothing; #3656's `willRevert` had no consumer.

**Corrected form:** #3199 stored the portfolio directly (`Map<string, ZerionWalletPortfolio>`, a failed fetch is a missing key); #3656 removed `willRevert` before it shipped.

**Spotted in:** #3199, #3656.
**Status:** active — `best-practices.md`'s "Nothing exported, declared or returned without a reader" rule owns this.

## Structure

### R-013: Interfaces, types, constants, and helpers inline in a service file

**Pattern:** a service or guard file that also declares its interface, its constants, its error class or Zod schema, and two or three module-level helper functions; or an error file that also exports its codes and types. The same remark covers an anonymous object type written out in full at two or more signatures — the same `Array<{ transaction: ...; dataDecoded: ... }>` repeated across methods of one file or across files — instead of being named once and imported.

**Why it's bad:** the file stops being findable by name — a reader looking for the interface has no reason to open the implementation — and a helper declared beside its one caller gets copied rather than imported by the second caller. This repo's naming convention exists precisely so each of these has a predictable path.

**Corrected form:** interface to `*.interface.ts`, constants and shared types to their own file beside it, helpers to a `helpers/` module, errors to `domain/errors/`, schemas to a `*.schema.ts` file. `module-structure.md` has the naming table. A repeated inline object type becomes one named type, generic where callers narrow it, in the owning module's `domain/entities/`:

```ts
// Don't — the same shape at every signature
transactions: Array<{ transaction: Transaction; dataDecoded: DataDecoded | null }>;
// Do — src/modules/transactions/domain/entities/decoded-transaction.entity.ts
export type DecodedTransaction<T extends Transaction = Transaction> = {
  transaction: T;
  dataDecoded: DataDecoded | null;
};
transactions: Array<DecodedTransaction<MultisigTransaction>>;
```

**Spotted in:** #3217 (three separate comments: "Interface should be extracted to another file", "Helpers should also be extracted to another file", "const and `type` should be extracted to a separate file"), #3284 ("i think its getting crowded, we can extract it to `types` file or smth"), #3703 (an inline pair type "is reused 3 times in current file and 1 time by `multisig-transaction.mapper.ts`. Maybe it is worth to extract this type and use everywhere"), #3078 ("Error should be extracted to another file.", "Type should be extracted to another file."), #3392 ("Should be moved to a separate schema file."), #3530 ("extract all the `const` s and `type` s to another file and only keep the error file here"), #3564 ("Everything outside the class should be extracted into external files."), #3744 ("I somehow dislike that this utility function is defined here in this file.").
**Status:** active

### R-014: A method too large to follow

**Pattern:** a method whose body carries two or more distinct concerns, typically visible as a long `if` branch handling an alternate mode inline.

**Why it's bad:** the branch that handles the secondary mode is the one nobody reads, and in the case that prompted this remark it was the local-private-key path in a token generator — the security-sensitive half. "quite large and very hard to follow, especially with the local private key logic which is handled in an `if` condition."

**Corrected form:** extract each concern into a named method; the outer method becomes the sequence of their names.

**Spotted in:** #3217 (`scripts/generate-token.ts`), #3526 ("this function does several things one after the other"), #3530 ("it could be refactored using private methods with clear names"), #3564 ("This method is almost 40 LOC, Can we extract it to smaller functions?"), #3621 ("getChainIdsBySafe could be its own function").
**Status:** active

### R-015: A generic API client that knows business specifics

**Pattern:** a provider-named datasource (`BlockaidApi`, `ZerionApi`) taking a domain concept as a parameter, or containing a rule that belongs to the feature using it.

**Why it's bad:** the client's job is to speak one provider's protocol; a domain rule inside it cannot be reused by the next feature that needs the same provider, and cannot be tested without standing up that feature's concepts. "BlockaidApi is a generic client and should not know about any biz specifics :)"

**Corrected form:** keep batching, timeouts, retries, and the request shape in the client; keep the domain decision in the service that calls it. #3214 landed exactly this way — the bulk scan moved into `BlockaidApi.scanAddressBulk`, owning timeout/retries, while the domain rule stayed in the scanner service.

**Spotted in:** #3214 (both directions of the same discussion), #3269.
**Status:** active

### R-016: Duplicating a guard or helper instead of extending it

**Pattern:** a new guard, auth helper, header builder, or provider client whose body is substantially an existing one with one value changed. The same remark covers a rule written out at two seams that must agree, and a single-item read left beside the batch variant that now runs the same query.

**Why it's bad:** two copies of an auth path means a fix applied to one silently leaves the other vulnerable. The counter-argument is real and sometimes wins — merging two security paths couples them — so the remark is a question to answer in the PR description, not an automatic change.

**Corrected form:** parameterize the existing one (a header name, a token source) and use it; or state in the PR body why coupling the two is worse than duplicating them, as #3217 ultimately did. For a non-auth read, have the single-item read delegate to the batch one — `(await this.findBySpaceIds([spaceId])).get(spaceId) ?? []`.

**Spotted in:** #3217 ("We could use or extend the current `AuthGuard`… The code here is mostly duplicated"), #3220 ("i wonder if we can have a base function that then is implemented/extended by both queue-service and tx-service helpers as the logic is exactly the same?"), #3533 ("Make it (await this.findBySpaceIds([spaceId])).get(spaceId) ?? []."), #3565 ("we could generalizes `src/datasources/kms/aws-kms-signer.service.ts` and have only the Ethereum part in this class"), #3619 ("extracting a separate function e.g. normalizeTagNameKey so it can be used in other places").
**Status:** active

### R-039: An `export` nothing outside the file imports

**Pattern:** a schema, DTO class or constant exported from a file whose only consumer is that same file — or exported and used nowhere at all.

**Why it's bad:** in #2856 the variant schemas were exported only because their siblings were, while every test went through the main `ThreatAnalysisResultSchema`; #2850's exported constant had no user at all.

**Corrected form:** drop the `export` (#2856, #3104), or the symbol when nothing uses it (#2850's `MIN_FALLBACK_HANDLER_VERSION`).

**Spotted in:** #2856, #3104, #2850.
**Status:** active — `best-practices.md`'s "Nothing exported, declared or returned without a reader" rule owns this. A candidate for tooling: once Knip's unused-exports check runs in CI, this flips to `solved-by-knip`.

### R-040: Query logic in the route service, business rules in the repository

**Pattern:** a `find…OrFail` lookup written as a private method on a route service, or a status check that throws a business exception (`ConflictException`) from inside a repository method.

**Why it's bad:** #3134's `renewInvite` loaded the member, checked `INVITED` and built the response, all in the repository, while #3107's survey lookup sat on the route service where no other service could reuse it.

**Corrected form:** #3107 moved the lookup to `SurveysRepository.findActiveBySlugOrFail`; #3134 moved the `INVITED` check into `MembersService`, leaving the repository's `renewInvite` a plain write.

**Spotted in:** #3107, #3134.
**Status:** active — `module-structure.md`'s "Queries in the repository, request rules in the route service" rule owns this.

### R-041: Input validated below the controller

**Pattern:** a format check on a route input — a `chainId`, a numeric or UUID id — inside a datasource or repository, instead of a `ValidationPipe` on the `@Param`.

**Why it's bad:** #3397's `ConfigApi` guard answered a malformed `chainId` with a `DataSourceError` 404 where the route pipe answers 422.

**Corrected form:** #3397 dropped the datasource guard and kept `@Param('chainId', new ValidationPipe(ChainIdSchema))` on the routes.

**Spotted in:** #3397, #3117.
**Status:** active — `api-dtos-and-validation.md`'s "ValidationPipe everywhere" rule owns this (non-negotiable #1).

## Naming

### R-017: A name that describes the mechanism instead of the thing

**Pattern:** `QueueService` for a client of the transaction-queue HTTP API, in a codebase that also has real message queues (BullMQ, AMQP). The same remark covers a type or function named for how it works rather than what it is or does: `PendingQueuedPolicy`, `PendingPolicySetup` and `PendingGuardConfiguration`, told apart only by how the change happens, or `getJobData` for a function that asserts the transaction is payable.

**Why it's bad:** the reader has to open the file to learn which of two unrelated concepts a name refers to, and every derived name inherits the ambiguity — module, interface, mock file, test module, cache key, and config key all had to be renamed together. This one remark was raised on at least six separate files across two PRs.

**Corrected form:** `TxQueueService` / `ITxQueueService` / `test.queue-service.module.ts` / `txQueueService` config key / `tx-queue-service` circuit-breaker key. Name each type or function for what it changes or does — `PendingGuardInstallation`, `PendingImmediateGuardPolicies`, `assertPayableTransaction`; a wire value a released client already reads keeps its name.

**Spotted in:** #3223 ("TxQueueServiceModule maybe? :)", "ITxQueueService?", "I am still convinced we should call it `txQueueService` to not mix with a real queue", "`tx-queue-service`?"), #3220 ("would also like it to be called `test.queue-service.module.ts`", "could we please rename the file to `queue-service.mock`"), #3669 ("All 3 are hard to distinguish by just names and purpose of each."), #3659 ("`PendingGuardSetup` is not a policy setup actually."), #3596 ("it assers the Safe acc and the Safe tx rather than getting job data").
**Status:** active

### R-018: Config keys named by service rather than by topic

**Pattern:** a new `configuration.ts` section named after the upstream service (`billingService`, `safeBillingServiceApi`) when a topic section (`billing`) already exists.

**Why it's bad:** the topic convention is what keeps related keys in one place — two sections for one topic means the next author adds a key to whichever they find first. The `-Service` suffix also encodes an implementation detail that changes when the upstream is replaced.

**Corrected form:** one section per topic, named for the topic; TTLs within it named `*TtlSeconds`.

**Spotted in:** #3228 ("there is already a section called `billing`, could you please consolidate them? I think the convention we use is to use the topic name, and lose `service`"), #3197 ("nit: could we please rename it to `walletPortfolioTtlSeconds` to be consistent with other TTLs"), #3245 ("ok, but i would say that also breaks the convention").
**Status:** active — see `configuration-and-flags.md`.

### R-019: A feature flag that isn't shaped like one

**Pattern:** a boolean config key gating a feature that is not declared as a flag, or a flag named too narrowly for what it gates (`zerionPositions` when it gates all of Zerion), or a new flag whose comment names no owner and no removal condition.

**Why it's bad:** a gate that isn't a declared flag has no removal condition and no consistent read path, so it becomes permanent config; a flag whose name is narrower than its effect gets read as safe to flip when it is not.

**Corrected form:** declare it with the `FF_` prefix, read it through `features.*`, name it for everything it gates, and give its mapping a comment naming the owner and the condition for removing it.

**Spotted in:** #3245 ("shouldnt this be a FF like the rest?"), #3157 ("it kind of doesnt go very well with other FF defined here… just calling it `Zerion` would be confusing, what about `zerionBalances`"), #3447 ("The flag comment needs an owner and a removal condition").
**Status:** active — see `configuration-and-flags.md`.

### R-035: One concept under two names

**Pattern:** a product alias beside the module's own name (`Copilot*` flags, guards and errors inside `safe-shield`), a stored value spelled differently from the config-service flag that gates the same feature, or env vars for one resource under two prefixes.

**Why it's bad:** every `Copilot*` name in #3454 matched every other, so the second name for Safe Shield only showed against the rest of the module; #3613's stored value and #3565's env vars split the same way.

**Corrected form:**

```ts
// Don't — in safe-shield
copilotCoreDisabled: process.env.FF_COPILOT_CORE_DISABLED?.toLowerCase() === 'true',
// Do
safeShieldCoreDisabled: process.env.FF_SAFE_SHIELD_CORE_DISABLED?.toLowerCase() === 'true',
```

**Spotted in:** #3454 ("I am concerned that we have 2 notions for safe shield. I think we should stick to one, and call it all s-s and not copilot"), #3613 ("I think it makes sense to even use the same string that we also use for the config-service feature flag. Then it is clear that they belong together."), #3565 ("nit: prefix `SAFENET_KMS_`").
**Status:** active — `module-structure.md`'s "One name per concept" rule owns this.

## Configuration

### R-042: A hard-coded environment-specific value or tunable

**Pattern:** a URL, TTL, timeout, buffer, poll interval or batch size declared as a literal constant — often under a `// TODO: make this configurable` — instead of read from configuration.

**Why it's bad:** #3135's `SPACE_INVITE_URL` would have pointed every invite email at `http://localhost:3001`, though its own TODO said it should be configurable.

**Corrected form:**

```ts
// Don't
export const SPACE_INVITE_URL = 'http://localhost:3001/welcome/spaces';
// Do
this.inviteUrl = new URL(SPACE_INVITE_PATH, this.configurationService.getOrThrow<string>('safeWebApp.baseUri')).toString();
```

#3419 and #3495 kept constants on purpose; the guide rule says which values stay.

**Spotted in:** #3135, #3284, #3214, #3564, #3565.
**Status:** active — `configuration-and-flags.md`'s "Environment-specific values and tunables come from config" rule owns this.

## Caching and upstream calls

### R-020: Bypassing `NetworkService` for an upstream call

**Pattern:** a `fetch` or a raw client call inside a datasource, usually to get at the raw response body.

**Why it's bad:** everything the shared path provides is lost silently — structured request logging, the circuit breaker, timeouts, and the error funnel — so the first upstream outage behaves differently for this one call than for every other. "If we bypass NetworkService I think we also skip things like logging and circuit breaker."

**Corrected form:** extend `INetworkService` with the option the call needs (#3269's reviewer suggested exactly this: an option to skip `response.json()`), rather than going around it.

**Spotted in:** #3269, #3259 (the related `readResponseBody()` / `maxResponseBodySize` work).
**Status:** active — this is non-negotiable #2; `caching-and-performance.md` owns it.

### R-021: A cache write with no matching invalidation

**Pattern:** a new cached read, or a raised TTL, in a diff that adds no `clear*()` call and no `EventCacheHelper` wiring; or a write path that posts upstream without clearing the caches its own reads populate; or a hand-written cache write after a fetch (an unconditional `hSet`) that ignores an invalidation landing while the fetch was in flight.

**Why it's bad:** the longer the TTL, the longer a client is served a value the service itself knows is stale — and the asymmetry is invisible in the diff that introduces it, because nothing fails. #3223 found `createMessage` and `updateMessageSignature` posting through the queue service while never clearing `getQueueMessagesBySafe` / `getQueueMessageByHash`, and found `clearMessagesBySafe/ByHash` clearing one cache layer where the transaction equivalent deliberately clears both.

**Corrected form:** the CacheRouter getter, the `CacheFirstDataSource` read, the `clear*()` on every write path, and the `EventCacheHelper` wiring all land in one PR. Raising a TTL without invalidation is a deliberate, stated trade-off: #3197 raised it to 60s only, with the invalidation tracked as a follow-up, rather than to the 1h the team wanted. A hand-written cache-after-fetch path records the fetch start time and skips the write when the key was invalidated at or after it, as `CacheFirstDataSource` does.

**Spotted in:** #3223 (two detailed findings), #3197, #3241, #3392 ("this unconditional `hSet` repopulates the cache with the pre-transaction response for another full TTL").
**Status:** active — `caching-and-performance.md` owns the new-cached-call recipe.

### R-022: Sequential or partial cache clears

**Pattern:** several independent `clear*()` calls awaited in sequence, or a clear path where one failure prevents the rest.

**Why it's bad:** the calls are independent, so sequencing them adds latency for nothing; worse, an early rejection leaves the remaining caches populated with data the service has already decided is invalid. `Promise.allSettled` clears all of them and still surfaces the failures.

**Corrected form:**

```ts
// Don't
await this.clearMultisigTransactions(args);
await this.clearQueueTransactions(args);
// Do
await Promise.allSettled([
  this.clearMultisigTransactions(args),
  this.clearQueueTransactions(args),
]);
```

**Spotted in:** #3223 ("Should we also use Promise.allSettled here? To make sure all caches are being cleared."), #3223 ("And why don't we re-use `this.clearMultisigTransactions` here?").
**Status:** active

### R-036: A cached value whose shape or meaning changes under the same key

**Pattern:** a diff that changes a cached schema (a new required key, a `.nullable()` that still requires the key) or what a cached entry means, while the `CacheRouter` key stays the same.

**Why it's bad:** in #3437 old entries would have failed quota checks, Safe-seat checks included, until they expired; #3447's 24h chain list would have kept routing opBNB to Zerion after deploy.

**Corrected form:** a new key; a cache read by hand may instead treat an unreadable entry as a miss.

```ts
// Don't
private static readonly ZERION_CHAINS_KEY = 'zerion_chains'; // now only indexed chains
// Do
private static readonly ZERION_CHAINS_KEY = 'zerion_indexed_chains';
```

**Spotted in:** #3437 ("Should we handle existing cached grants before making counter mandatory?"), #3447 ("Change the chain-list cache field (`zerion_chains`, 24h). Otherwise the old list keeps serving opBNB after deploy.").
**Status:** active — `caching-and-performance.md`'s "A changed cached shape or meaning gets a new key" rule owns this.

### R-043: Independent awaits in sequence

**Pattern:** two or more independent repository or upstream calls awaited one after another, or an `await` inside a per-item loop. R-022 covers the cache-clear case.

**Why it's bad:** in #3451 the endpoint awaited `enabledModules()` once per Safe, so on cache misses its latency grew with the number of Safes in the Space.

**Corrected form:**

```ts
// Don't
const members = await this.membersRepository.findAuthorizedMembersOrFail({ authPayload, spaceId });
const activeAdmin = await this.membersRepository.findActiveAdmin({ userId, spaceId });
// Do
const [members, activeAdmin] = await Promise.all([
  this.membersRepository.findAuthorizedMembersOrFail({ authPayload, spaceId }),
  this.membersRepository.findActiveAdmin({ userId, spaceId }),
]);
```

#3451's per-Safe reads went through `batched()`; #3437's relay checks stayed sequential on purpose.

**Spotted in:** #3131, #3451.
**Status:** active — `caching-and-performance.md`'s "Independent awaits run concurrently" rule owns this, with "Batch and chunk upstream calls" for the batch size.

## Logging and errors

### R-023: `info` level for a high-volume event path

**Pattern:** `loggingService.info(...)` inside an AMQP event handler, a cache-invalidation helper, or any per-event code path.

**Why it's bad:** the volume is set by upstream event traffic, not by anything in this service, so an `info` line there floods the log backend and buries the lines that matter. "Would rather make a `debug` log, it might print way too many logs in DD given the number of events we are treating."

**Corrected form:** `debug` for expected, high-frequency events; `info` for a per-request or per-lifecycle fact; `error` for a failure someone must act on.

**Spotted in:** #3241 (`event-cache.helper.ts`).
**Status:** active — `security.md` owns what may appear in the fields.

### R-024: A missing authorization assertion on a new endpoint

**Pattern:** a new handler on a controller whose sibling handlers all begin with an ownership or membership assertion, and this one does not.

**Why it's bad:** authorization missing from one handler in an otherwise-guarded controller is the least visible security defect there is — it looks correct next to its neighbors, and every test of it passes. It also sometimes *is* correct, which is why the answer belongs in the PR description: #3269's checkout-session endpoint receives only a `sessionId` and genuinely cannot resolve a `spaceId`, and the reviewer accepted that only because the PR body said so.

**Corrected form:** add the assertion, or state in the PR body why the route cannot carry one and what bounds the exposure instead.

**Spotted in:** #3269 ("Shouldn't this function also have a `assertSpaceMember` assertion, like the other functions in this file?"), #3445 ("I’m missing the same admin protection for the session URL").
**Status:** active — `security.md` owns guard placement.

### R-025: An env var read but not validated

**Pattern:** a new `process.env.X` read in `configuration.ts` with no corresponding entry in `RootConfigurationSchema`.

**Why it's bad:** the variable then fails at the first request that needs it rather than at boot, and a secret with a fallback default silently runs the service in an insecure mode instead of refusing to start.

**Corrected form:** declare it in `configuration.ts` *and* `RootConfigurationSchema`, add it to `.env.sample.json`, mirror it in `__tests__/configuration.ts`, and run `yarn env:validate`.

**Spotted in:** #3228 ("oh could you please also add a check for `BILLING_WEBHOOK_JWT_PUBLIC_KEY`, I forgot about it"), #3217 ("Nit: We can handle it in our validator. We should validate this env variable and transform it if it's valid."), #3078 ("All these env vars should be validated"), #3447 ("Add `FF_ZERION_TESTNETS_ENABLED` to `RootConfigurationSchema`.").
**Status:** active — non-negotiable #7; `configuration-and-flags.md` owns it.

## Hygiene

### R-026: Redundant conditions and needless intermediates

**Pattern:** `if (!chain || !addresses.length)` where `!addresses.length` suffices; an `args` parameter guarded at three call sites because it is optional; a `const` used exactly once, immediately below its declaration; a `.default(false)` after a `.catch(false)` that already covers `undefined`; a method that only forwards to a helper.

**Why it's bad:** each is a small amount of code carrying no information, and together they are what makes a diff long enough that reviewers stop reading closely.

**Corrected form:** the leaner expression. Biome catches part of this — in #3214 it simplified the condition to `!(chain && addresses.length)` on its own once the redundant clause was removed.

**Spotted in:** #3214 ("maybe im too particular, but why not just say `!addresses.length`? So much leaner"), #3218 ("can it be simplified to… as optional fields will be `undefined` by default already"), #3228 ("nit: maybe we can lose `args` here is they are optional anyway. Less checks"), #3217 ("It's used only once on line 23, we could remove the `const`"), #2856 ("why cant we pass `error` without checking for it if its an optional field?"), #3105 ("you can skip `.default(false)` as `.catch(false)` already handles undefined"), #3375 ("I had to jump back and forth between the repository and the helper"), #3742 ("Is this wrapper required?").
**Status:** partially solved-by-biome — biome's `complexity` rules catch some shapes; the parameter-and-intermediate cases are still human-caught.

### R-027: Debug scripts and scaffolding left in the branch

**Pattern:** a seed script, a login helper, or a transient logging block in the diff, with a review comment promising its removal.

**Why it's bad:** "This file will be removed before merging" is a promise a reviewer has to remember to re-verify, and the one that was not re-verified is the `// TODO: transient logging for debugging` block still in `src/datasources/cache/cache.first.data.source.ts` — which `best-practices.md` now has to cite as the repo's live anti-example for double-casting.

**Corrected form:** remove it before marking the PR ready.

**Spotted in:** #3245 (`scripts/seed-fake-users.ts`, `scripts/login-as-seeded-user.ts`), #2856 (a `console.log` under a TODO: "I think this is committed by mistake."), #3451 (`scripts/others/setup-space.ts`: "are you sure we should add this script to the repo?").
**Status:** active — `commits-and-prs.md` owns the rule.

### R-028: Deferring a convention fix because the PR is large

**Pattern:** "let's rename these in a follow-up PR" on a naming or convention violation the PR itself introduced.

**Why it's bad:** the follow-up is unowned, so the repo keeps the wrong name and the next author copies it — this is exactly how the four coexisting controller-versioning styles and the `relay`/`relayer` scope split came about. Deferring a fix to *pre-existing* code is fine; deferring one to code the PR is adding is not.

**Corrected form:** fix what the PR introduces, in the PR. If the change really is too large to also carry the fix, that is R-029's problem, not a reason to merge the violation.

**Spotted in:** #3245 ("This PR is already huge. Let's open another PR to rename all such keys."), #3157 ("Let's merge this rename and consolidate the feature flags in another PR."), #3294 ("Agree. I'll open another PR for that 👍"), #3550 (a new `ordering?: string` parameter: "I'd do it in a follow up PR as it will change quite some files."), #3373 ("I will tackle this under #3372 instead").
**Status:** active

### R-029: A PR carrying more than one concern

**Pattern:** a diff that mixes a rename with a behavior change, a dependency bump with feature work, or several modules for unrelated reasons — including a bug fix or a flaky-test fix found while building the feature.

**Why it's bad:** the review degrades to sampling, and a revert becomes all-or-nothing — #2926's 19-file performance refactor was reverted wholesale by #3034 the same day because the one bad change could not be separated from the eighteen good ones.

**Corrected form:** split along the seam and land the mechanical half first. `commits-and-prs.md` has the splitting rule and the ordering. A fix found along the way ships as its own PR with its regression test, as #3563 did with #3610.

**Spotted in:** #3245, #3197 ("for the time saving lets split in 2 PRs"), #2926 → #3034, #2845 ("If it fixes a flaky test it should be tackled in a separate PR."), #3563 ("if it's a bug we're trying to fix, it should be extracted to a separate PR").
**Status:** active

### R-030: An unpinned third-party GitHub Action

**Pattern:** `uses: some/action@v1` in a workflow file.

**Why it's bad:** a tag is mutable, so the code that runs in CI — with repository credentials — can change without any commit in this repo. A commit hash cannot.

**Corrected form:** `uses: some/action@<full-sha>  # v1.2.3`.

**Spotted in:** #3294 ("it is better to pin against a hash").
**Status:** active

### R-034: A removal that leaves its dependents behind

**Pattern:** a diff removing a feature, endpoint or env-driven path that keeps its env vars in `.env.sample.json` or `.devcontainer/docker-compose.yml`, or leaves sibling endpoints of the same deprecated family, and the code only they call, in place.

**Why it's bad:** #3105 would have left three relay variables documented in `.env.sample.json` and the devcontainer after the code stopped reading them, and #3225 first removed one deprecated `/raw` route while its two siblings, and the code only they called, stayed.

**Corrected form:** #3105 deleted the entries from both files; #3225 removed all three `/raw` routes down to the datasource.

**Spotted in:** #3105 ("There are leftovers of the env variables RELAY_DAILY_LIMIT_CHAIN_IDS, RELAY_FEE_CHAIN_IDS, RELAY_SIMULATION_CHAIN_IDS in .env.sample.json and .devcontainer/docker-compose.yml"), #3225 ("Let's remove all `/raw` endpoints in this PR.").
**Status:** active — `commits-and-prs.md`'s "A removal takes what only it used" rule owns this.

## Authorization

### R-031: A private copy of the Workspace admin or member check

**Pattern:** a `private async assertActiveAdmin(...)` in a service, an inline `membersRepository.findOne({ role: 'ADMIN', status: 'ACTIVE', ... })`, or a repository query that filters the space by the caller's membership — where `assertMember` / `assertAdmin` from `src/modules/spaces/domain/space-assert.utils.ts` would do.

**Why it's bad:** every copy is another place a fix has to land, and they drift — the repo reached five implementations of one predicate, three 403 messages, and one endpoint answering 404. The helpers return the membership row, so a copy returning `void` also costs a second query when the caller needs the role.

**Corrected form:**

```ts
// Don't
private async assertActiveAdmin(...): Promise<void> {
  const member = await this.membersRepository.findOne({ ..., status: 'ACTIVE', role: 'ADMIN' });
  if (!member) throw new ForbiddenException('User is not an active admin.');
}
// Do
const member = await assertMember(this.membersRepository, spaceId, userId);
const callerIsAdmin = member.role === 'ADMIN'; // or assertAdmin(...) when admin is required
```

**Spotted in:** #2539, #3026, #3107, #3175 — one copy each, consolidated in one follow-up.
**Status:** active — `security.md`'s "Workspace authorization through the shared assertions only" rule owns this.
