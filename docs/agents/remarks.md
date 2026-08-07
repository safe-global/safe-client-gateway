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

**Spotted in:** #3247 ("nit: please ask your Claude to memo that there is no need to cast to unknown"), #3241, #3196 (three separate comments), #3214.
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

**Spotted in:** #3247 ("a bit weird - why do we cast to `never`?", "looks like there are a bunch of places where it uses `never`").
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

**Pattern:** a hard-coded string, number, or address as a spec input, where nothing about the assertion depends on that exact value.

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

**Spotted in:** #3217 (five separate comments: "We should use `faker`", "Should be a random string", "We should use a random number", "Nit: We should use `faker` here as well"), #3157.
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

**Pattern:** `// Arrange` / `// create a space and assert it exists` above code that reads identically.

**Why it's bad:** a comment that paraphrases the next line has to be maintained alongside it and is wrong the moment it isn't, while adding nothing a reader of the line does not already have.

**Corrected form:** delete the comment; if the test needs explanation, the `it(...)` description is the place for it.

**Spotted in:** #3290 (three comments: "I think this comment is bit redundent", "I think we don't need to explain explicitly", "here the same").
**Status:** active

### R-008: Tests that assert the framework, not the behavior

**Pattern:** a spec that checks a config object has the keys it was literally just given, or that a Zod schema rejects the wrong type.

**Why it's bad:** the assertion restates the source rather than constraining it, so it can never fail for a reason anyone cares about while still costing maintenance on every refactor. "they dont bring much value" (#3157) is the review outcome.

**Corrected form:** assert the behavior that depends on the config or the schema, not the declaration itself.

**Spotted in:** #3157 ("dont hurt to have but also not sure we really need these tests :) they dont bring much value", "dont trust everything claude says :)").
**Status:** active

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

**Pattern:** a DTO field declared `field?: T | null` where the schema allows only one of the two, or `@ApiProperty({ nullable: true })` on a field the type says is optional.

**Why it's bad:** `undefined` (key absent) and `null` (key present, empty) are different wire payloads, and the generated OpenAPI document is what clients build against — so a mismatch here is a contract bug that no test in this repo catches. "nullable is not optional, and i dont see `undefined` allowed on these values anywhere" (#3223).

**Corrected form:**

```ts
// Don't
@ApiProperty({ nullable: true })
safe?: `0x${string}` | null;
// Do — pick the one the schema allows, and annotate it accordingly
@ApiPropertyOptional({ type: String })
safe?: `0x${string}`;
```

**Spotted in:** #3223 ("so its optional and nullable? something doesnt add up here", "if its optional it should be `safe?:...`", "could we please check the swagger annotations"), #3200 ("lets mark optional fields as `@ApiPropertyOptional`").
**Status:** active — `api-dtos-and-validation.md` owns the schema/DTO pairing.

### R-011: A new schema where a shared one exists

**Pattern:** an inline `z.string().regex(...)` or a fresh schema object that duplicates something already exported from a shared schemas module.

**Why it's bad:** two schemas encoding one rule drift the moment only one is fixed — and the shared ones already carry the edge cases a fresh regex will miss (`NonNegativeNumericStringSchema` was itself found to accept leading zeros in #3200, a bug fixed once in the shared schema rather than in each copy).

**Corrected form:** import the existing schema; if it is nearly right, generalize it in place and rename it rather than forking it.

**Spotted in:** #3200 ("`NonNegativeNumericStringSchema` wont work here?"), #3269 ("Might make sense to re-use `PaymentLinkMetadataSchema` (with a more generic name) here and other places?").
**Status:** active

### R-012: String-literal unions instead of a `const` array

**Pattern:** a Zod enum written as inline literals, with the same literals re-typed in the test builder.

**Why it's bad:** the schema and the builder end up with two independent lists, so adding a member to one silently leaves the other stale. A single `as const` array feeds both — `z.enum([...X])` and `faker.helpers.arrayElement(X)` — so a new member reaches the tests for free.

**Corrected form:**

```ts
// Do
export const SubscriptionStatus = ['active', 'past_due', 'canceled'] as const;
export const SubscriptionSchema = z.object({ status: z.enum([...SubscriptionStatus]) });
// and in the builder
status: faker.helpers.arrayElement(SubscriptionStatus),
```

**Spotted in:** #3228 (the `SubscriptionStatus` suggestion, "maybe we could set them as `const` to avoid using literals?").
**Status:** active

## Structure

### R-013: Interfaces, types, constants, and helpers inline in a service file

**Pattern:** a service or guard file that also declares its interface, its constants, and two or three module-level helper functions.

**Why it's bad:** the file stops being findable by name — a reader looking for the interface has no reason to open the implementation — and a helper declared beside its one caller gets copied rather than imported by the second caller. This repo's naming convention exists precisely so each of these has a predictable path.

**Corrected form:** interface to `*.interface.ts`, constants and shared types to their own file beside it, helpers to a `helpers/` module. `module-structure.md` has the naming table.

**Spotted in:** #3217 (three separate comments: "Interface should be extracted to another file", "Helpers should also be extracted to another file", "const and `type` should be extracted to a separate file"), #3284 ("i think its getting crowded, we can extract it to `types` file or smth").
**Status:** active

### R-014: A method too large to follow

**Pattern:** a method whose body carries two or more distinct concerns, typically visible as a long `if` branch handling an alternate mode inline.

**Why it's bad:** the branch that handles the secondary mode is the one nobody reads, and in the case that prompted this remark it was the local-private-key path in a token generator — the security-sensitive half. "quite large and very hard to follow, especially with the local private key logic which is handled in an `if` condition."

**Corrected form:** extract each concern into a named method; the outer method becomes the sequence of their names.

**Spotted in:** #3217 (`scripts/generate-token.ts`).
**Status:** active

### R-015: A generic API client that knows business specifics

**Pattern:** a provider-named datasource (`BlockaidApi`, `ZerionApi`) taking a domain concept as a parameter, or containing a rule that belongs to the feature using it.

**Why it's bad:** the client's job is to speak one provider's protocol; a domain rule inside it cannot be reused by the next feature that needs the same provider, and cannot be tested without standing up that feature's concepts. "BlockaidApi is a generic client and should not know about any biz specifics :)"

**Corrected form:** keep batching, timeouts, retries, and the request shape in the client; keep the domain decision in the service that calls it. #3214 landed exactly this way — the bulk scan moved into `BlockaidApi.scanAddressBulk`, owning timeout/retries, while the domain rule stayed in the scanner service.

**Spotted in:** #3214 (both directions of the same discussion), #3269.
**Status:** active

### R-016: Duplicating a guard or helper instead of extending it

**Pattern:** a new guard, auth helper, or header builder whose body is substantially an existing one with one value changed.

**Why it's bad:** two copies of an auth path means a fix applied to one silently leaves the other vulnerable. The counter-argument is real and sometimes wins — merging two security paths couples them — so the remark is a question to answer in the PR description, not an automatic change.

**Corrected form:** parameterize the existing one (a header name, a token source) and use it; or state in the PR body why coupling the two is worse than duplicating them, as #3217 ultimately did.

**Spotted in:** #3217 ("We could use or extend the current `AuthGuard`… The code here is mostly duplicated"), #3220 ("i wonder if we can have a base function that then is implemented/extended by both queue-service and tx-service helpers as the logic is exactly the same?").
**Status:** active

## Naming

### R-017: A name that describes the mechanism instead of the thing

**Pattern:** `QueueService` for a client of the transaction-queue HTTP API, in a codebase that also has real message queues (BullMQ, AMQP).

**Why it's bad:** the reader has to open the file to learn which of two unrelated concepts a name refers to, and every derived name inherits the ambiguity — module, interface, mock file, test module, cache key, and config key all had to be renamed together. This one remark was raised on at least six separate files across two PRs.

**Corrected form:** `TxQueueService` / `ITxQueueService` / `test.queue-service.module.ts` / `txQueueService` config key / `tx-queue-service` circuit-breaker key.

**Spotted in:** #3223 ("TxQueueServiceModule maybe? :)", "ITxQueueService?", "I am still convinced we should call it `txQueueService` to not mix with a real queue", "`tx-queue-service`?"), #3220 ("would also like it to be called `test.queue-service.module.ts`", "could we please rename the file to `queue-service.mock`").
**Status:** active

### R-018: Config keys named by service rather than by topic

**Pattern:** a new `configuration.ts` section named after the upstream service (`billingService`, `safeBillingServiceApi`) when a topic section (`billing`) already exists.

**Why it's bad:** the topic convention is what keeps related keys in one place — two sections for one topic means the next author adds a key to whichever they find first. The `-Service` suffix also encodes an implementation detail that changes when the upstream is replaced.

**Corrected form:** one section per topic, named for the topic; TTLs within it named `*TtlSeconds`.

**Spotted in:** #3228 ("there is already a section called `billing`, could you please consolidate them? I think the convention we use is to use the topic name, and lose `service`"), #3197 ("nit: could we please rename it to `walletPortfolioTtlSeconds` to be consistent with other TTLs"), #3245 ("ok, but i would say that also breaks the convention").
**Status:** active — see `configuration-and-flags.md`.

### R-019: A feature flag that isn't shaped like one

**Pattern:** a boolean config key gating a feature that is not declared as a flag, or a flag named too narrowly for what it gates (`zerionPositions` when it gates all of Zerion).

**Why it's bad:** a gate that isn't a declared flag has no removal condition and no consistent read path, so it becomes permanent config; a flag whose name is narrower than its effect gets read as safe to flip when it is not.

**Corrected form:** declare it with the `FF_` prefix, read it through `features.*`, and name it for everything it gates.

**Spotted in:** #3245 ("shouldnt this be a FF like the rest?"), #3157 ("it kind of doesnt go very well with other FF defined here… just calling it `Zerion` would be confusing, what about `zerionBalances`").
**Status:** active — see `configuration-and-flags.md`.

## Caching and upstream calls

### R-020: Bypassing `NetworkService` for an upstream call

**Pattern:** a `fetch` or a raw client call inside a datasource, usually to get at the raw response body.

**Why it's bad:** everything the shared path provides is lost silently — structured request logging, the circuit breaker, timeouts, and the error funnel — so the first upstream outage behaves differently for this one call than for every other. "If we bypass NetworkService I think we also skip things like logging and circuit breaker."

**Corrected form:** extend `INetworkService` with the option the call needs (#3269's reviewer suggested exactly this: an option to skip `response.json()`), rather than going around it.

**Spotted in:** #3269, #3259 (the related `readResponseBody()` / `maxResponseBodySize` work).
**Status:** active — this is non-negotiable #2; `caching-and-performance.md` owns it.

### R-021: A cache write with no matching invalidation

**Pattern:** a new cached read, or a raised TTL, in a diff that adds no `clear*()` call and no `EventCacheHelper` wiring; or a write path that posts upstream without clearing the caches its own reads populate.

**Why it's bad:** the longer the TTL, the longer a client is served a value the service itself knows is stale — and the asymmetry is invisible in the diff that introduces it, because nothing fails. #3223 found `createMessage` and `updateMessageSignature` posting through the queue service while never clearing `getQueueMessagesBySafe` / `getQueueMessageByHash`, and found `clearMessagesBySafe/ByHash` clearing one cache layer where the transaction equivalent deliberately clears both.

**Corrected form:** the CacheRouter getter, the `CacheFirstDataSource` read, the `clear*()` on every write path, and the `EventCacheHelper` wiring all land in one PR. Raising a TTL without invalidation is a deliberate, stated trade-off: #3197 raised it to 60s only, with the invalidation tracked as a follow-up, rather than to the 1h the team wanted.

**Spotted in:** #3223 (two detailed findings), #3197, #3241.
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

**Spotted in:** #3269 ("Shouldn't this function also have a `assertSpaceMember` assertion, like the other functions in this file?").
**Status:** active — `security.md` owns guard placement.

### R-025: An env var read but not validated

**Pattern:** a new `process.env.X` read in `configuration.ts` with no corresponding entry in `RootConfigurationSchema`.

**Why it's bad:** the variable then fails at the first request that needs it rather than at boot, and a secret with a fallback default silently runs the service in an insecure mode instead of refusing to start.

**Corrected form:** declare it in `configuration.ts` *and* `RootConfigurationSchema`, add it to `.env.sample.json`, mirror it in `__tests__/configuration.ts`, and run `yarn env:validate`.

**Spotted in:** #3228 ("oh could you please also add a check for `BILLING_WEBHOOK_JWT_PUBLIC_KEY`, I forgot about it"), #3217 ("Nit: We can handle it in our validator. We should validate this env variable and transform it if it's valid.").
**Status:** active — non-negotiable #7; `configuration-and-flags.md` owns it.

## Hygiene

### R-026: Redundant conditions and needless intermediates

**Pattern:** `if (!chain || !addresses.length)` where `!addresses.length` suffices; an `args` parameter guarded at three call sites because it is optional; a `const` used exactly once, immediately below its declaration.

**Why it's bad:** each is a small amount of code carrying no information, and together they are what makes a diff long enough that reviewers stop reading closely.

**Corrected form:** the leaner expression. Biome catches part of this — in #3214 it simplified the condition to `!(chain && addresses.length)` on its own once the redundant clause was removed.

**Spotted in:** #3214 ("maybe im too particular, but why not just say `!addresses.length`? So much leaner"), #3218 ("can it be simplified to… as optional fields will be `undefined` by default already"), #3228 ("nit: maybe we can lose `args` here is they are optional anyway. Less checks"), #3217 ("It's used only once on line 23, we could remove the `const`").
**Status:** partially solved-by-biome — biome's `complexity` rules catch some shapes; the parameter-and-intermediate cases are still human-caught.

### R-027: Debug scripts and scaffolding left in the branch

**Pattern:** a seed script, a login helper, or a transient logging block in the diff, with a review comment promising its removal.

**Why it's bad:** "This file will be removed before merging" is a promise a reviewer has to remember to re-verify, and the one that was not re-verified is the `// TODO: transient logging for debugging` block still in `src/datasources/cache/cache.first.data.source.ts` — which `best-practices.md` now has to cite as the repo's live anti-example for double-casting.

**Corrected form:** remove it before marking the PR ready.

**Spotted in:** #3245 (`scripts/seed-fake-users.ts`, `scripts/login-as-seeded-user.ts`).
**Status:** active — `commits-and-prs.md` owns the rule.

### R-028: Deferring a convention fix because the PR is large

**Pattern:** "let's rename these in a follow-up PR" on a naming or convention violation the PR itself introduced.

**Why it's bad:** the follow-up is unowned, so the repo keeps the wrong name and the next author copies it — this is exactly how the four coexisting controller-versioning styles and the `relay`/`relayer` scope split came about. Deferring a fix to *pre-existing* code is fine; deferring one to code the PR is adding is not.

**Corrected form:** fix what the PR introduces, in the PR. If the change really is too large to also carry the fix, that is R-029's problem, not a reason to merge the violation.

**Spotted in:** #3245 ("This PR is already huge. Let's open another PR to rename all such keys."), #3157 ("Let's merge this rename and consolidate the feature flags in another PR."), #3294 ("Agree. I'll open another PR for that 👍").
**Status:** active

### R-029: A PR carrying more than one concern

**Pattern:** a diff that mixes a rename with a behavior change, a dependency bump with feature work, or several modules for unrelated reasons.

**Why it's bad:** the review degrades to sampling, and a revert becomes all-or-nothing — #2926's 19-file performance refactor was reverted wholesale by #3034 the same day because the one bad change could not be separated from the eighteen good ones.

**Corrected form:** split along the seam and land the mechanical half first. `commits-and-prs.md` has the splitting rule and the ordering.

**Spotted in:** #3245, #3197 ("for the time saving lets split in 2 PRs"), #2926 → #3034.
**Status:** active

### R-030: An unpinned third-party GitHub Action

**Pattern:** `uses: some/action@v1` in a workflow file.

**Why it's bad:** a tag is mutable, so the code that runs in CI — with repository credentials — can change without any commit in this repo. A commit hash cannot.

**Corrected form:** `uses: some/action@<full-sha>  # v1.2.3`.

**Spotted in:** #3294 ("it is better to pin against a hash").
**Status:** active
