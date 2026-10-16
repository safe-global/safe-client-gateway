<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Open Question Options

This document turns unresolved convention questions into concrete choices. Each
option points to existing CGW code so the team can decide based on local
precedent instead of generic NestJS style.

## OQ-ROUTE-01 Versioned Route Layout

Question: should new versioned APIs prefer `routes/v2` or module-level `v1/`
folders?

### Option A: Version Inside `routes/`

Use when the feature already follows the normal `routes/` layout and only a
specific route surface needs another version.

Existing examples:

- `src/modules/chains/routes/v2/chains.v2.controller.ts`
- `src/modules/delegate/routes/v2/delegates.v2.controller.ts`
- `src/modules/safe/routes/v2/safes.v2.controller.ts`
- `src/modules/notifications/routes/v2/notifications.controller.ts`

Shape:

```text
src/modules/<feature>/
  routes/
    <feature>.controller.ts
    <feature>.service.ts
    v2/
      <feature>.v2.controller.ts
      <feature>.v2.service.ts
```

Example:

```ts
@Controller({
  path: 'chains',
  version: '2',
})
export class ChainsV2Controller {}
```

Choose this when:

- v1 and v2 share most domain/repository/datasource code.
- The version boundary is mainly HTTP/request/response behavior.
- The module should remain recognizable as a standard route/domain module.

### Option B: Version At Module Subfolder Level

Use when the version is a larger API product surface with its own controller,
service, entities, mappers, consumers, or datasources.

Existing examples:

- `src/modules/portfolio/v1/portfolio.controller.ts`
- `src/modules/csv-export/v1/csv-export.controller.ts`

Shape:

```text
src/modules/<feature>/
  domain/
  datasources/
  v1/
    <feature>.controller.ts
    <feature>.service.ts
    entities/
    <feature>.mapper.ts
```

Example:

```ts
@Controller({
  path: '',
  version: '1',
})
export class PortfolioController {}
```

Choose this when:

- The version owns a distinct API composition layer.
- The version needs mappers, consumers, or separate DTO families.
- The feature already has a domain service that is reused by one or more API
  versions.

Recommendation candidate: prefer `routes/v2` for normal endpoint evolution.
Use module-level `v1/` only when the version has enough internal structure to
justify a separate API submodule.

## OQ-MOD-01 External API Interface Location

Question: when should external API interfaces live in `src/domain/interfaces`
versus `src/modules/<feature>/interfaces`?

### Option A: Global Interface

Use when the external API boundary is shared infrastructure or likely to be
consumed by multiple modules.

Existing examples:

- `src/domain/interfaces/positions-api.interface.ts`
- `src/domain/interfaces/transaction-api.interface.ts`
- `src/domain/interfaces/config-api.interface.ts`

Example:

```ts
export const IPositionsApi = Symbol('IPositionsApi');

export interface IPositionsApi {
  getPositions(args: {
    safeAddress: Address;
    fiatCode: string;
    chain: Chain;
  }): Promise<Raw<Array<Position>>>;
}
```

Choose this when:

- The API is part of shared CGW infrastructure.
- More than one feature may reasonably depend on the boundary.
- The datasource module lives under `src/datasources`.

### Option B: Feature-Owned Interface

Use when the external API boundary exists only for one feature and should not
be advertised as shared infrastructure.

Existing example:

- `src/modules/portfolio/interfaces/portfolio-api.interface.ts`

Example:

```ts
export const IPortfolioApi = Symbol('IPortfolioApi');

export interface IPortfolioApi {
  getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds?: Array<string>;
  }): Promise<Raw<Portfolio>>;
}
```

Choose this when:

- The API exists only to serve one feature module.
- The implementation lives under `src/modules/<feature>/datasources`.
- Exporting the interface globally would invite accidental coupling.

Recommendation candidate: default to feature-owned interfaces for
feature-owned datasources. Use `src/domain/interfaces` only for shared
infrastructure or cross-feature APIs.

## OQ-TYPE-01 DTO Schema Location

Question: should route DTO validation schemas live in the DTO entity file or a
nested `entities/schemas` folder?

### Option A: Schema In The DTO Entity File

Use for small request bodies or params where the schema and DTO are naturally
read together.

Existing examples:

- `src/modules/spaces/routes/entities/address-book-request.dto.entity.ts`
- `src/modules/auth/routes/entities/siwe.dto.entity.ts`

Example:

```ts
export const CreateAddressBookRequestSchema = z.object({
  address: AddressSchema,
});

export class CreateAddressBookRequestDto implements z.infer<
  typeof CreateAddressBookRequestSchema
> {
  @ApiProperty({ type: String })
  public readonly address!: Address;
}
```

Choose this when:

- The schema is short.
- The schema is only used by the DTO/controller.
- Keeping schema and Swagger DTO together improves readability.

### Option B: Schema In `entities/schemas`

Use for larger, reusable, or independently tested schemas.

Existing examples:

- `src/modules/portfolio/v1/entities/schemas/get-portfolio.dto.schema.ts`
- `src/modules/delegate/routes/entities/schemas/create-delegate.dto.schema.ts`
- `src/modules/chains/domain/entities/schemas/chain.schema.ts`

Example:

```ts
export const GetPortfolioDtoSchema = z.object({
  fiatCode: z.string().optional().default('USD'),
  chainIds: ChainIdsSchema,
  trusted: BooleanStringDefaultTrueSchema,
});
```

Choose this when:

- The schema has helpers, transforms, unions, or composition.
- The schema has its own unit tests.
- Multiple DTOs or services reuse it.

Recommendation candidate: colocate small DTO schemas in the DTO entity file.
Promote to `entities/schemas` when complexity, reuse, or tests justify it.

## OQ-DB-01 Product-Owned DB Entity Location

Question: should feature-owned TypeORM DB entities always live under
`datasources/entities`, or should pure persistence concerns move elsewhere?

### Option A: `datasources/entities`

Use for product-owned tables. This is the dominant current pattern.

Existing examples:

- `src/modules/spaces/datasources/entities/user-address-book-item.entity.db.ts`
- `src/modules/users/datasources/entities/users.entity.db.ts`
- `src/modules/counterfactual-safes/datasources/entities/counterfactual-safe.entity.db.ts`
- `src/modules/notifications/datasources/entities/notification-devices.entity.db.ts`

Shape:

```text
src/modules/<feature>/
  datasources/
    entities/
      <thing>.entity.db.ts
  domain/
    entities/
      <thing>.entity.ts
```

Example:

```ts
@Entity('user_address_book_items')
@Unique('UQ_UABI_space_creator_address', ['space', 'creator', 'address'])
export class UserAddressBookItem implements DomainUserAddressBookItem {}
```

Choose this when:

- The file is a TypeORM table mapping.
- The table is owned by this product feature.
- The domain entity remains separate from DB mapping concerns.

### Option B: Repository Submodule Owns Persistence

Use when persistence is versioned or operationally separate enough to warrant a
repository module.

Existing example:

- `src/modules/notifications/domain/v2/notifications.repository.module.ts`

Example:

```ts
@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([
      NotificationType,
      NotificationDevice,
      NotificationSubscription,
    ]),
  ],
  providers: [
    {
      provide: INotificationsRepositoryV2,
      useClass: NotificationsRepositoryV2,
    },
  ],
  exports: [INotificationsRepositoryV2],
})
export class NotificationsRepositoryV2Module {}
```

Choose this when:

- The repository boundary is independently imported by route modules.
- Versioning or queue/push complexity makes a nested module clearer.
- Tests benefit from replacing a repository module with a test module.

Recommendation candidate: keep TypeORM entities in
`src/modules/<feature>/datasources/entities` by default. Add repository
submodules only when import boundaries or versioning require them.

## OQ-DB-02 Primary Key Type For New Product Tables

Question: should new CGW-owned product tables use UUID primary keys by default,
or keep using `SERIAL` when they sit inside a domain whose related tables and
foreign keys are still sequential integers?

### Option A: Prefer UUID For New Tables

Use when a new table is externally referenced, replicated, shared across
services, or likely to outlive a single CGW-local persistence concern.

Potential shape:

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

Choose this when:

- The ID may be exposed externally or copied across systems.
- The table is part of a new isolated product area.
- The repository does not need to join heavily with legacy integer-key tables.

### Option B: Match The Local Integer-Key Domain

Use when the new table is tightly coupled to existing `SERIAL` tables and all
surrounding FKs, repository methods, fixtures, and migrations use integer IDs.

Existing examples:

- `spaces.id`
- `users.id`
- `space_address_book_items.id`
- `counterfactual_safes.id`

Potential shape:

```sql
id SERIAL PRIMARY KEY
```

Choose this when:

- The table belongs to an existing integer-keyed feature domain.
- FKs point primarily at existing integer-keyed CGW tables.
- Switching only one table would create type inconsistency until a wider
  sequential-to-UUID migration happens.

Recommendation candidate: prefer UUID for new isolated product surfaces, but
match local integer-key domains until the team runs a coordinated migration for
that domain.

## OQ-MOD-02 `forwardRef` And Module Cycles

Question: are `forwardRef` usages in auth/users/spaces accepted as local
exceptions, or should new work actively avoid expanding those cycles?

### Option A: Accept Local Cycles As Exceptions

Existing examples:

- `src/modules/auth/auth.module.ts`
- `src/modules/users/users.module.ts`
- `src/modules/spaces/spaces.module.ts`
- `src/modules/counterfactual-safes/counterfactual-safes.module.ts`

Example:

```ts
@Module({
  imports: [forwardRef(() => AuthModule), forwardRef(() => UsersModule)],
})
export class SpacesModule {}
```

Choose this only when:

- The cycle already exists and the change stays inside that local boundary.
- Breaking the cycle would be a larger architectural change than the feature.
- The PR documents why the cycle is not expanded further.

### Option B: Extract A Third Boundary

Use for new dependencies that would create another cycle.

Potential shapes already present in the repo:

- A focused repository module, as in `notifications/domain/v2`.
- A shared route utility, as in `spaces/routes/utils/space-assert.utils.ts`.
- A shared infrastructure module, as in `src/datasources/*`.

Shape:

```text
src/modules/<feature>/
  domain/
    <thing>.module.ts
    <thing>.repository.interface.ts
    <thing>.repository.ts
```

Choose this when:

- A module needs only a small subset of another module.
- The dependency is really a shared repository/helper boundary.
- Adding `forwardRef` would make three or more modules mutually coupled.

Recommendation candidate: treat existing `forwardRef` as local debt. Do not
add new cycles without first considering a repository/helper/module extraction.

## OQ-MOD-03 Official "Copy This" Examples

Question: which modules should be official examples for new product features?

### Option A: Compact HTTP + External API Feature

Use `src/modules/positions`.

Best for:

- New read-oriented endpoint families.
- External API datasource plus repository validation.
- Route DTO mapping without product-owned DB tables.

### Option B: Large Product-Owned Persistence Feature

Use `src/modules/spaces`.

Best for:

- Multiple controllers/services under one product concern.
- Product-owned TypeORM entities.
- Auth/member assertions and e2e route coverage.
- Subdomain repositories under `domain/<subdomain>`.

### Option C: Compact Persistence + Bulk Repository Feature

Use `src/modules/counterfactual-safes`.

Best for:

- Product-owned tables with junction ownership.
- Bulk insert/select patterns.
- Transactional repository methods.
- Idempotent writes with `orIgnore`.

Recommendation candidate: document all three as official examples, but route
agents to the matching example based on feature shape.

## OQ-SEC-01 CSV Formula Escaping: In-House Or Library

Question: should CSV formula-injection escaping stay in-house
(`src/modules/csv-export/csv-utils/escape-csv-formula.ts`) or move to
`csv-stringify`'s built-in `escape_formulas` option?

Raised in PR #3178 (post-merge comment by TimDaub,
issue comment 4797008227).

### Option A: Keep The In-House Escaper

Existing example:

- `src/modules/csv-export/csv-utils/escape-csv-formula.ts` (covers ASCII and
  full-width trigger characters, paired with the `NUMERIC_COLUMNS` exemption
  and `cast.string`/`cast.number` defense-in-depth added in #3178)

Choose this when:

- The trigger set must exceed what the library covers (full-width forms).
- The exemption logic (numeric columns from internal data) should stay
  explicit and tested locally.

### Option B: Use `csv-stringify`'s `escape_formulas`

Reference: https://csv.js.org/stringify/options/escape_formulas/

Choose this when:

- The library's implementation is verified to cover at least the current
  trigger set (including full-width variants).
- Less in-house security-sensitive code is preferred over local control.

Open until someone compares the library's trigger set against the in-house
one and the team picks a side.

## OQ-TYPE-02 Defensive Normalization Of Third-Party Display Text

Question: when a provider's field is documented (or observed) to arrive in a
fixed shape, should CGW normalize it defensively anyway, or depend on the
provider's guarantee?

Raised in PR #2824 (review comments 2581880992 by `cursor[bot]` and 2598411023
by PooyaRaki). `prepareDescription` appends a period unconditionally
(`return \`${description}.\``). Both reviewers asked for a conditional append;
the author answered that Blockaid returns descriptions without punctuation, and
the unconditional form merged and is still in `main`.

### Option A: Trust The Provider Contract

Existing example:

- `src/modules/safe-shield/threat-analysis/blockaid/blockaid-api.constants.ts`
  (`prepareDescription` appends `.` unconditionally)

Choose this when:

- The provider's output shape is verified and a change would be caught by the
  response schema or a test.
- The defensive branch would be untestable against real data and would
  silently diverge from the provider's actual behavior.

### Option B: Normalize Defensively At The Boundary

Choose this when:

- The field is display text with no schema enforcing its shape, so a provider
  change degrades the UI instead of failing loudly.
- The normalization is one cheap idempotent branch
  (`description.endsWith('.') ? description : \`${description}.\``).

Recurred in PR #3423 (review comment thread on `@claude review`, author reply
5678546872): Zerion's chain list is lower-cased on write while the portfolio
distribution is read with the same key, and a mixed-case key from upstream
would silently miss and degrade every Safe on that chain. The author chose
Option A again — "we trust the Zerion API to return valid data" — so the
repo has now taken the same side twice without writing it down.

Open until the team decides whether provider-format assumptions must be
enforced by a schema/test when they are relied on, or normalized at the
boundary regardless. Two data points now favour Option A; what is missing is
the rule that says so, and whether the assumption gets a pinning test.

## OQ-TEST-01 How Service Specs Type Their Collaborator Mocks

Question: should a service spec type a collaborator mock as
`MockedObject<IFace>`, or narrow it to the methods the spec actually uses with
`MockedObject<Pick<IFace, 'a' | 'b'>>`?

Raised in PR #3420, where the same PR went both ways. The author added the
narrowed form on one review comment, reverted it on another (review comments
3978886193 and 3978942901: "why not have `as MockedObject<IBillingApi>`?",
"then we don't need `as unknown as IBillingApi`"), and restored it for a third
(issue comment 5601447708). The narrowed form needs `as unknown as IFace` at
the construction sites, which the repo otherwise treats as a smell.

### Option A: Whole-Interface Mock

Existing example:

- `src/modules/billing/routes/billing.service.spec.ts` (`as MockedObject<IBillingApi>`)

Choose this when:

- Construction should stay cast-free; `as unknown as` is the thing being avoided.
- The mock object is expected to track the interface as it grows.

Trade-off: a method the service starts calling later is silently `undefined`
rather than a clear failure, and on a `Promise`-returning method that surfaces
far from the cause.

### Option B: Narrowed `Pick` Mock

Existing example:

- `src/modules/entitlements/routes/subscription-sync.service.spec.ts`

Choose this when:

- The spec should state which collaborators it exercises, and an unlisted call
  should fail loudly.
- Declaring `vi.fn()` entries nothing calls is considered worse (an arch-review
  in this same PR asked for exactly such an entry to be deleted).

Trade-off: needs `as unknown as IFace` at each construction site.

Open until the team decides which cost it prefers — a silently-undefined method
on the wide form, or the `as unknown as` cast the narrow form requires. Note the
repo-wide position on `as unknown as` (see `best-practices.md` baselines) likely
settles this, and whichever wins should be stated in the testing guide so a
review cannot ask for both in one PR.

## OQ-CONFIG-01 Env-Var Renames: One-Release Fallback Or Coordinated Hard Rename

Question: when an env var is renamed, should the loader read the old name as a
fallback for one release, or should the rename land as a hard rename with the
deployed values updated alongside it?

`CHANGE-04` currently requires the fallback, from PR #2851 (RL-20260108-001).
PR #3443 (RL-20260923-002) went the other way. The Fastify migration renamed
`EXPRESS_TRUST_PROXY` / `EXPRESS_JSON_LIMIT` to `HTTP_SERVER_*` with no
fallback. Review asked to check the deployed (Argo) value instead, and an
added guard that threw on the old names was removed as unnecessary (review
comment 4069930039).

### Option A: Fallback For One Release

Existing example: `docs/engineering/sources/examples/configuration.md`
(`CHANGE-04 / CONFIG-05` block).

Choose this when:

- The variable is consumed by deployments the PR author does not control
  (self-hosters, other teams' environments).
- A missed rename would silently flip behavior instead of failing at boot.

Trade-off: two names live in the loader until a follow-up PR deletes one.

### Option B: Hard Rename, Deployed Values Updated With It

Existing example: PR #3443 (`HTTP_SERVER_TRUST_PROXY`, `HTTP_SERVER_BODY_LIMIT`).

Choose this when:

- Every deployment that sets the variable is in the team's own infra config
  and is updated in the same release.

Trade-off: a deployment that still sets the old name silently falls back to the
default. For `trustProxy` that changes `request.ip` and rate-limit keys.

Open until the team states which case each option covers. Whichever wins should
be reflected in `CHANGE-04`'s env-var clause, which today states Option A
unconditionally.

## OQ-TYPE-03 `ChainIdSchema` Accepts Non-Canonical Numeric Strings

Question: should `ChainIdSchema` be tightened to the canonical numeric-ID
shape, or is chain id a documented exception to `TYPE-03`'s numeric-ID clause?

`TYPE-03` says numeric-string ID schemas reject zero, leading zeros, signs and
floats (`/^[1-9]\d*$/`). `ChainIdSchema`
(`src/modules/chains/domain/entities/schemas/chain-id.schema.ts`) is
`NumericStringSchema` plus a length cap, so it still accepts `007` and `-1`.
PR #3454 (RL-20260922-002, review comments 4071248277 and 4072481687) moved two
routes from `NumericStringSchema` to `ChainIdSchema` and noted it is the same
shape today. PR #3200 (RL-20260703-002) tightened
`NonNegativeNumericStringSchema` instead and deferred the `ChainIdSchema`
consolidation to its own PR, which has not landed.

### Option A: Tighten `ChainIdSchema`

Build it on the canonical shape, with tests for `007`, `-1`, `1.5` and `0`:

```ts
export const ChainIdSchema = NonNegativeNumericStringSchema.refine(
  (value) => value !== '0' && value.length <= CHAIN_ID_MAXLENGTH,
);
```

Choose this when:

- Every route and upstream payload parsed with it already carries canonical
  chain ids, so the change is a 422 for malformed input only.

Trade-off: it reaches every route and datasource that parses a chain id in one
PR, so it needs a check of which upstream responses it parses.

### Option B: Keep It Loose And Document The Exception

Choose this when:

- Some upstream (Config Service, indexers) sends chain ids the strict shape
  would reject, and failing those payloads is worse than accepting `007`.

Trade-off: `TYPE-03` then needs an explicit carve-out, and cache keys or
lookups can see `137` and `0137` as different chains.

Open until the team picks one; whichever wins should be stated in `TYPE-01` or
`TYPE-03`, which today point routes at `ChainIdSchema` and require the strict
shape at the same time.

## OQ-PR-01 Exact Counts In The Agent Guides

Question: may `docs/agents/*.md` state exact tallies (for example the number of
guards in `nestjs-patterns.md`), or must they describe the set without a count?

`PR-02` says docs do not carry exact counts that drift with every PR. In
PR #3446 (RL-20260807-002, issue comments 5728882578 and 5728917270) the diff
deleted two guards and `nestjs-patterns.md` still stated the old tally; the
author updated the number instead of removing it, and review accepted that.

### Option A: Drop The Count

Describe the set and point at where it lives:

```md
Guards live under `routes/guards/` in the module that owns them.
```

Choose this when:

- The number tells a reader nothing they act on, and every add or remove
  would otherwise have to edit the guide.

### Option B: Allow Counts In That Guide

Choose this when:

- The count is a deliberate inventory check, so a stale number is meant to
  draw a reviewer's eye to an unlisted guard.

Trade-off: `PR-02` needs a carve-out naming which guides may hold counts, and
every guard change edits the guide in the same PR.

Open until the team picks one; whichever wins should be reflected in `PR-02`.

## OQ-DB-03 Expensive I/O Inside A Lock When Atomicity Needs It

Question: `DB-02` says expensive I/O (KMS, upstream calls) happens before the
lock is taken. When a second write must commit with the first and its input
can only be prepared by I/O, which wins: atomicity, or a lock free of I/O?

PR #3532 (RL-20261001-006, review comment 4156816360) merged with the address
book names encrypted through KMS inside the Safe seat lock, so the Safes and
their names commit or roll back together. The PR body lists this as a
trade-off: the lock is per space, so only concurrent adds to the same
workspace wait longer. The Safe rows themselves are still encrypted before the
transaction opens.

### Option A: Atomicity Wins, I/O Stays Minimal Inside

Existing example:

- `src/modules/spaces/routes/safes/space-safes.service.ts` (`create`:
  `encryptRows` before the transaction, `upsertMany` encrypting names after
  `lockSeats`)

Choose this when:

- A partial write (Safes without names) is worse than a longer lock.
- The lock is narrow (one row or one tenant), so only that tenant waits.

Trade-off: `DB-02` needs a carve-out, and a slow KMS call now holds a
transaction and a pooled connection.

### Option B: Prepare Everything Before The Lock

Encrypt the names before the transaction as the Safe rows already are, and
pass ciphertext into the repository write:

```ts
const rows = await this.spaceSafesRepository.encryptRows(spaceId, payload);
const names = await this.addressBookItemsRepository.encryptItems(spaceId, items);

await this.postgresDatabaseService.transaction(async (entityManager) => {
  await this.spaceSafesRepository.lockSeats(spaceId, entityManager);
  // checks, insertRows, upsertEncrypted(names) — no KMS inside
});
```

Choose this when:

- The second write's preparation does not depend on state read under the lock.

Trade-off: the address-book repository needs an encrypt-then-write split, a
second API beside `upsertMany`.

Open until the team decides whether `DB-02`'s "I/O before the lock" is a hard
rule or yields to atomicity; whichever wins should be stated in `DB-02`.

## OQ-STYLE-01 Where A Single-File Constant Lives

Question: does a constant used by one file move to its module's
`*.constants.ts` when one exists, or stay beside its only consumer?

In PR #3536 (review comment 4165424732, author reply 5952062301, point 6)
review suggested moving `LONGEST_MONTH_MS` next to `DAY_IN_MS` in
`entitlements.constants.ts`, citing remark R-013 in `docs/agents/remarks.md`.
The author kept it in `entitlements.rules.ts` because nothing else uses it, and
the PR merged that way. `REUSE-01`'s check asks about "constants homes", and
R-013 is written about service files, while `entitlements.rules.ts` is a module
of pure functions.

### Option A: Constants File When The Module Has One

Existing example:

- `src/modules/entitlements/domain/entitlements.constants.ts` (`DAY_IN_MS`)

```ts
// entitlements.constants.ts
export const DAY_IN_MS = 24 * 60 * 60 * 1_000;
export const LONGEST_MONTH_MS = 31 * DAY_IN_MS;
```

Choose this when:

- Related units already live there, so a reader looks there first.
- A second consumer is likely and should import rather than copy.

### Option B: Beside The Only Consumer

Existing example:

- `src/modules/entitlements/domain/entitlements.rules.ts` (`LONGEST_MONTH_MS`)

Choose this when:

- The constant is private to one pure-function module and exporting it would
  widen the module's surface for no consumer.

Trade-off: a second consumer has to move it first.

Open until the team states whether R-013 covers non-service files; whichever
wins should be stated in `STYLE-01` or `REUSE-01`.

## OQ-TEST-02 Boundary Tests For Guards Outside The Expected Input Domain

Question: must a guard that no current input reaches (a clamp against clock
skew, a threshold between real cycle lengths) be pinned by a boundary test, or
is it enough that the real input set is covered?

In PR #3536 review asked three times for tests that a mutation would otherwise
survive: `now = start - 1ms` for a `Math.max` clamp (review comment
4165424718), the exact Feb 28 / Mar 1 rollover for a plan starting on the 31st
(4165424724), and a 32-day cycle around `LONGEST_MONTH_MS` (4165424730). The
author declined all three (issue comment 5952062301): upstream only sends
monthly, annual, 30-day and 60-day cycles. Review approved "as by discussion".
`TEST-09` says edges need tests "when they are part of the behavior", which
does not settle whether a defensive guard is.

### Option A: Every Guard Gets A Boundary Row

```ts
it.each([
  { now: new Date(start.getTime() - 1), expected: start },
  { now: start, expected: start },
])('clamps a now before the cycle start to month 0', ({ now, expected }) => {
  expect(quotaWindow({ cycleStart: start, cycleEnd, now }).start).toStrictEqual(expected);
});
```

Choose this when:

- Removing the guard should fail a test, so the next refactor cannot drop it
  silently.
- The guard protects money or quota (a refill, a 12x grant).

### Option B: Cover The Real Input Set Only

Choose this when:

- The inputs come from a closed upstream set, and tests for impossible inputs
  would pin behavior nobody specified.

Trade-off: a guard that no test fails without reads as dead code to the next
editor.

Open until the team decides; whichever wins should be stated in `TEST-09`.

## OQ-CACHE-01 Event-Driven Invalidation Or Eager Clearing After Writes

Question: after CGW forwards a write upstream (propose, confirm, delete), does
it clear the affected caches itself, or rely on the upstream's AMQP event to do
it?

In PR #3491 (review comment 4104155915, author replies 4104770204 and
4104868699) an eager queue-cache clear after propose was dropped as redundant,
since the event handler clears both cache layers. The author noted the repo
does both today and asked to settle it one way: if events are reliable the
eager clears are dead weight, and if not, propose has the same gap that
delete covers. It is also unconfirmed whether the queue service publishes
those events to the exchange.

### Option A: Events Only

Existing example:

- `src/modules/safe/domain/safe.repository.ts` (propose via the queue service:
  no explicit clear)

Choose this when:

- Every upstream that accepts writes publishes the matching event, verified
  per upstream (tx-service and queue service).

Trade-off: delete and confirm's eager clears are removed, and a lost event
leaves the cache stale for its TTL (60 s default).

### Option B: Eager Clear On Every Write, Events As Backup

Existing example:

- `src/modules/safe/domain/safe.repository.ts` (`deleteTransaction`: "Ensure
  transaction is removed from cache in case event is not received")

Choose this when:

- An upstream does not publish events, or its delivery is not guaranteed.

Trade-off: every write path carries a clear, and propose needs one added.

Open until someone confirms which upstreams publish write events; whichever
wins should be stated in `CACHE-01`.
