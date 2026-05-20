<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Project Structure

Use this before making code changes. This guide describes where code belongs in
CGW and which existing shapes are safe to copy. It is based on the current
repository, not generic NestJS architecture.

## Default Module Shape

Most product and API concerns live under `src/modules/<feature>/`:

```text
src/modules/<feature>/
  <feature>.module.ts
  routes/
    <feature>.controller.ts
    <feature>.service.ts
    entities/
  domain/
    <feature>.repository.interface.ts
    <feature>.repository.ts
    entities/
  datasources/
    entities/
```

Use this shape when a feature has an HTTP surface, domain persistence or
external data, and route DTOs.

Route-only modules can be thinner when they only expose a small HTTP surface.
Infrastructure modules can omit `routes/` when they only provide shared
services.

## Copy These Examples

`src/modules/positions` is the compact example for a repository-backed route
flow. It shows controller, route service, repository interface, repository,
external API datasource, route DTOs, domain entities, Zod validation, cache
usage, and response mapping.

`src/modules/spaces` is the large product-module example. Copy it when a
feature owns multiple route families, product DB entities, member assertions,
TypeORM wiring, repository interfaces, and e2e tests. Do not copy its
`forwardRef` cycles as a default design choice.

`src/modules/users` is the example for user/member persistence, wallet
relationships, authenticated user narrowing, transactions, and repository-level
uniqueness/race handling.

`src/modules/auth` is the home for auth payload entities, guards, decorators,
and auth assertions such as `assertAuthenticated` and
`getAuthenticatedUserIdOrFail`.

`src/modules/counterfactual-safes` is a compact persistence example with DB
entities, route DTOs, transactions, bulk insert/select patterns, and
junction-table ownership.

## Avoid Copying By Default

`src/modules/safe-shield` is workflow-oriented, with root controller/service
files and nested analysis modules. Use it only for similarly workflow-heavy
features.

`src/modules/csv-export/v1` is a versioned export workflow with consumers and
datasource code under `v1`. Use it for queue/export flows, not ordinary route
modules.

`src/modules/auth/oidc` is a specialized identity-provider implementation.
Keep OIDC-specific conventions local to auth unless adding another identity
provider.

Existing `forwardRef` usage in auth, users, spaces, and counterfactual safes is
local history, not a preferred default. Before adding a new cycle, check
whether ownership can be simplified or shared code can move.

## Controllers And Route Services

Controllers stay at the HTTP boundary. They own NestJS route decorators,
Swagger decorators, guards, pipes, route/query/body parsing, and delegation to
route services.

Swagger and route copy should describe the public contract, not the internal
provider used to satisfy it. Do not label an input as a standard such as
CAIP-10 unless the implementation actually accepts that standard.

Route services orchestrate product use cases. They call repositories, shared
route helpers, auth/member assertions, and mappers. They should not call
low-level external API datasources directly.

Copy:

- `src/modules/positions/routes/positions.controller.ts`
- `src/modules/positions/routes/positions.service.ts`
- `src/modules/spaces/routes/*service.ts`

## Repositories And Datasources

Repositories are the domain persistence and domain-data boundary. They validate
raw datasource results, query TypeORM repositories, manage transactions, batch
lookups, and map expected database or datasource failures into domain errors.

Datasources are HTTP/cache/external adapter code or TypeORM entity ownership
for module-owned persistence tables.

Feature-owned DB entities usually live under:

```text
src/modules/<feature>/datasources/entities/
```

Shared infrastructure datasources live under:

```text
src/datasources/
```

Copy:

- `src/modules/positions/domain/positions.repository.ts`
- `src/modules/users/domain/users.repository.ts`
- `src/modules/users/domain/members.repository.ts`
- `src/modules/positions/datasources/zerion-positions-api.service.ts`

## Entities, DTOs, And Schemas

CGW uses `*.entity.ts` files for both domain entities and route DTO classes.
Route DTO classes carry Swagger decorators. Domain entities usually export Zod
schemas and inferred types.

Keep small DTO schemas near the DTO entity when the schema is only used there.
Promote schemas to `entities/schemas/` when they are larger, reused,
independently tested, or composed from helpers.

Use shared schemas from `src/validation/entities/schemas` and shared domain
schema helpers before adding new address, hex, UUID, date, timezone, redirect
URL, or signature validation.

Copy:

- `src/modules/spaces/routes/entities/address-book-request.dto.entity.ts`
- `src/modules/auth/routes/entities/siwe.dto.entity.ts`
- `src/modules/delegate/routes/entities/schemas/create-delegate.dto.schema.ts`
- `src/modules/chains/domain/entities/schemas/chain.schema.ts`

## Interfaces And Injection

Repository interfaces live next to repositories. External API interfaces live
with the owning feature when the adapter is feature-owned, or under
`src/domain/interfaces` when the API boundary is shared infrastructure.

Use symbol tokens and module provider wiring such as:

```ts
{ provide: IThingRepository, useClass: ThingRepository }
```

Do not create an interface, provider, factory, or injection token for a
single-use implementation detail unless there is a real boundary, lifecycle, or
testability reason.

## Versioned Routes

CGW currently has two versioning shapes:

```text
src/modules/<feature>/routes/v2/
src/modules/<feature>/v1/
```

Prefer `routes/v2` for normal endpoint evolution when versions share the same
domain/repository/datasource code. Use a module-level version folder when the
version owns a distinct API composition layer with its own mappers, consumers,
DTO families, or datasources.

Copy:

- `src/modules/chains/routes/v2/chains.v2.controller.ts`
- `src/modules/delegate/routes/v2/delegates.v2.controller.ts`
- `src/modules/portfolio/v1/portfolio.controller.ts`
- `src/modules/csv-export/v1/csv-export.controller.ts`

## Tests

Unit specs sit next to the file under test as `*.spec.ts`. Integration specs
use `*.integration.spec.ts`. E2E specs use `*.e2e-spec.ts`, commonly under
`routes/` or `routes/__tests__/`.

Use builders, fakes, and test modules close to the entity/module they support.
Use e2e tests for externally observable API behavior; use service or repository
tests for internal branching, persistence rules, and state setup that the API
does not expose.

Copy:

- `src/modules/positions/routes/positions.service.spec.ts`
- `src/modules/spaces/routes/spaces.controller.e2e-spec.ts`
- `src/modules/users/domain/users.repository.integration.spec.ts`
- `src/modules/notifications/domain/v2/test.notification.repository.module.ts`

## Database And Migrations

Product-owned TypeORM entities live under module datasources. Product modules
wire them with `TypeOrmModule.forFeature(...)`. Repository methods use
`PostgresDatabaseService` for repositories and transactions. Migrations are
timestamped files in `migrations/`.

When adding persistence, keep migrations, TypeORM entities, domain schemas,
repository tests, entity registration, indexes, rollback assumptions, enum
transformers, and timestamp behavior aligned as one contract.

Unique constraints must match lifecycle behavior. Nullable unique fields often
need partial indexes, and terminal rows should not block future submissions
unless that is intentional.

Aggregates must match the data returned to clients. Compute totals after the
same filtering used for response items, and preserve meaningful signed values
such as debt positions instead of treating every negative fiat value as dust.

## Config And External State

Config values belong in `configuration.schema.ts` or a dedicated config schema
and should fail at startup when invalid. Request-invariant config should be
read during construction and stored as class state.

Secrets and auth headers may flow through request options, but logs and cache
diagnostics must not expose them. If a cache key includes request options,
only log the derived opaque key/hash and never the raw serialized request.

Cache keys must identify upstream endpoint and parameters unambiguously.
Multi-step cache writes and Redis pipelines are state transitions; check every
meaningful result.

Cache readers and writers must agree on the payload shape. If the cached value
is already normalized domain data, cache-hit code must not run the same
normalization again. If a datasource cache has no active invalidation hook,
leave a short code comment naming the expiration that bounds staleness.
