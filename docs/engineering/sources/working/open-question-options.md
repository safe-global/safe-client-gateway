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
