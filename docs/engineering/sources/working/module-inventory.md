<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Module Inventory Research

This is a research artifact, not yet the final convention manual. It records
how CGW is structured today so that future rules reflect this repository
instead of a generic NestJS ideal. Use it together with
`docs/engineering/working/review-learning-coverage.md` and the other files in
`docs/engineering/working`.

## High-Level Shape

The dominant module shape is:

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

This shape is common, but not universal. CGW also has global infrastructure in
`src/datasources`, shared domain primitives in `src/domain`, shared route
plumbing in `src/routes/common`, and validation primitives in `src/validation`.

## Candidate Canonical Modules

| Area                               | Why it is useful                                                                                                                                                                                   | Caveats                                                                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/positions`            | Compact example of route controller, route service, repository interface, repository, external API datasource, route DTOs, domain entities, Zod validation, cache usage, and API response mapping. | Its module currently exports both the datasource API and repository, so copy the layering more than the exact exports.                  |
| `src/modules/spaces`               | Strong example for product-owned DB entities, multiple controllers/services in one product module, repository interfaces, TypeORM wiring, e2e route tests, and auth/member assertions.             | It uses `forwardRef` with auth/users, so do not treat that cycle as an ideal default.                                                   |
| `src/modules/users`                | Useful example for user/member persistence, wallet relationships, authenticated user narrowing, transaction use, and repository-level uniqueness/race handling.                                    | Also participates in `forwardRef` cycles with auth/spaces.                                                                              |
| `src/modules/auth`                 | Canonical place for auth payload entities, guards, decorators, and assertion helpers such as `assertAuthenticated` and `getAuthenticatedUserIdOrFail`.                                             | Auth has OIDC substructure, so its shape is more specialized than a normal route feature.                                               |
| `src/modules/notifications`        | Example of versioned route modules and a separate repository module under `domain/v2`.                                                                                                             | More modular than most features; copy when versioning or queue/push complexity justifies it.                                            |
| `src/modules/portfolio`            | Example of a newer `v1/` route API with mapper/service separation and domain service interface.                                                                                                    | It diverges from the common `routes/` folder convention. Confirm before using it as the default for new modules.                        |
| `src/modules/counterfactual-safes` | Compact product-owned persistence example with DB entities, route DTOs, multiple controllers, transaction use, bulk insert/select patterns, and junction-table ownership.                          | It currently imports auth/users/spaces with `forwardRef`; copy its repository batching/transaction patterns more than its module graph. |

## Special Cases And Avoid-Copying Notes

| Area                                                  | Why it is special                                                                                                                                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/safe-shield`                             | Feature is organized by analysis workflow folders with root controller/service and separate nested analysis modules. It is not the common route/domain/datasource module template.                        |
| `src/modules/csv-export/v1`                           | Versioned export workflow with consumers and datasource under `v1`; useful for queue/export flows, not general route modules.                                                                             |
| `src/modules/notifications/routes/v1` and `routes/v2` | Good precedent for versioned APIs when versions differ materially. Avoid creating version folders by default when a normal `routes/` shape is enough.                                                     |
| `src/modules/auth/oidc`                               | Specialized auth provider implementation. Keep OIDC conventions local to auth unless adding another identity provider.                                                                                    |
| `src/datasources/*`                                   | Shared infrastructure and external services used across modules. Feature-owned APIs sometimes live under `src/modules/<feature>/datasources`; global APIs live here. Decide based on ownership and reuse. |

## Current Main Snapshot

Snapshot taken on 2026-04-28 from `main` at `8465f19f`.

Common module shapes:

- Route-only modules exist for thin HTTP surfaces, for example `about`,
  `owners`, `recovery`, and `root`.
- Most product/API modules use `routes/` plus `domain/`, for example
  `chains`, `community`, `contracts`, `fees`, `messages`, `safe`,
  and `safe-apps`.
- Modules that own external adapters or persistence tables add
  `datasources/`, for example `balances`, `counterfactual-safes`,
  `positions`, `spaces`, `targeted-messaging`, `transactions`, and `users`.
- Infrastructure-style modules often omit `routes/`, for example `queues`,
  `staking`, `swaps`, `wallets`, and `zerion`.
- Versioned routes appear in both `routes/v2` (`chains`, `delegate`,
  `notifications`, `safe`) and module-level `v1` folders (`csv-export`,
  `portfolio`). This is not settled enough to make one default rule.

Concrete examples from current main:

- `spaces` is the best current example for a large product module with
  multiple route families. `spaces.module.ts` wires controllers/services for
  spaces, members, space safes, shared address books, private address books,
  and address-book requests while keeping repositories under
  `domain/address-books`.
- `counterfactual-safes` is the best current example for compact persistence
  with bulk repository operations. Its repository normalizes submitted
  addresses once, bulk-inserts canonical rows with `orIgnore`, fetches
  authoritative rows in one query, validates initialization equality, and
  bulk-inserts user associations.
- `space-assert.utils.ts` demonstrates the preferred split between
  non-throwing predicates and throwing assertions: `isAdmin` returns boolean,
  while `assertAdmin` throws.

Avoid copying as default:

- `safe-shield` remains a workflow-oriented feature with root
  controller/service and analysis submodules. Use it only as precedent for
  similarly workflow-heavy features.
- `forwardRef` in `auth`, `users`, `spaces`, and `counterfactual-safes` is an
  accepted local reality, not a default design tool for new modules.
- Unconditional uniqueness on lifecycle rows should be checked against the
  review-learning rule before copying. For example, address-book requests use
  `(space_id, requested_by, address)` uniqueness while also having
  `PENDING`/`APPROVED`/`REJECTED` status; decide explicitly whether terminal
  requests should block resubmission.

## Observed Layer Responsibilities

### Controllers

Controllers are HTTP boundary code. They define NestJS route decorators,
Swagger decorators, guards/pipes where needed, parse route/query/body inputs,
and delegate to route services.

Observed examples:

- `src/modules/positions/routes/positions.controller.ts` uses
  `@Controller`, `@Get`, `@Param`, `@Query`, Swagger decorators, and
  `ValidationPipe(AddressSchema)`, then calls `PositionsService`.
- `src/modules/users/routes/users.controller.ts` keeps user route
  documentation and HTTP behavior in `routes/`.
- Versioned route controllers live either under `routes/v2` or a module-level
  `v1/` folder, depending on the feature history.

### Route Services

Route services orchestrate use cases. They call repositories, shared route
helpers, and mappers. They should not call low-level external API datasources
directly.

Observed examples:

- `src/modules/positions/routes/positions.service.ts` loads chain data through
  `IChainsRepository`, then calls `IPositionsRepository`, then maps domain
  positions into route response DTOs.
- `src/modules/spaces/routes/*service.ts` coordinates repository calls and
  auth/member assertions for product workflows.

### Repositories

Repositories are the domain persistence and domain-data boundary. They validate
raw datasource results, query TypeORM repositories, manage transactions, and map
database or datasource errors into domain/API errors.

Observed examples:

- `src/modules/positions/domain/positions.repository.ts` calls
  `IPositionsApi` and validates results with `PositionsSchema`.
- `src/modules/users/domain/users.repository.ts` owns user persistence flows,
  transaction use, wallet creation coordination, and race handling for unique
  wallet/user constraints.
- `src/modules/users/domain/members.repository.ts` owns member queries,
  invite/accept/decline flows, transaction use, and unique-constraint mapping.

### Datasources

Datasources are HTTP/cache/external adapter code or database entity ownership
for module-owned persistence tables.

Observed examples:

- `src/modules/positions/datasources/zerion-positions-api.service.ts` owns
  Zerion request construction, cache reads/writes, external response parsing,
  and `HttpErrorFactory` mapping.
- `src/modules/users/datasources/entities/*.entity.db.ts` and
  `src/modules/spaces/datasources/entities/*.entity.db.ts` own TypeORM DB
  entities for product persistence.
- Shared infrastructure datasources such as network, cache, DB, JWT, storage,
  and push notifications live under `src/datasources`.

### Entities, DTOs, And Schemas

CGW uses `*.entity.ts` files for both domain entities and route DTO classes.
Route DTO classes commonly carry Swagger decorators. Zod schemas often live
next to the entity they validate, with nested `entities/schemas` folders used
in several modules.

Observed examples:

- `src/modules/positions/domain/entities/position.entity.ts` exports domain
  schemas and inferred types.
- `src/modules/positions/routes/entities/*.entity.ts` exports response DTO
  classes with Swagger decorators.
- `src/modules/delegate/routes/entities/schemas/*.schema.ts`,
  `src/modules/chains/domain/entities/schemas/*.schema.ts`, and
  `src/validation/entities/schemas/*.schema.ts` show the nested schema style.
- `src/validation/entities/schemas/address.schema.ts` is reused at route
  boundaries via `ValidationPipe`.

## Dependency Injection And Interfaces

Common patterns:

- Repository interfaces live next to repositories, for example
  `positions.repository.interface.ts`.
- External API interfaces often live in `src/domain/interfaces`, for example
  `positions-api.interface.ts`, when the API boundary is shared or global.
- Some feature-owned API interfaces live inside the feature, for example
  `src/modules/portfolio/interfaces/portfolio-api.interface.ts`.
- Interface tokens are symbol-based and injected with `@Inject(...)`.
- Module providers commonly use `{ provide: IThing, useClass: Thing }`.

## Testing Layout

Common patterns:

- Unit specs sit next to the file under test as `*.spec.ts`.
- Integration specs use `*.integration.spec.ts`.
- E2E specs use `*.e2e-spec.ts`, commonly under `routes/` or
  `routes/__tests__/`.
- Builders and test modules usually live in `__tests__` folders close to the
  entity/module they support.
- `package.json` separates default unit-ish tests from `test:integration`,
  `test:e2e`, and `test:all`.

Examples:

- `src/modules/positions/routes/positions.service.spec.ts`
- `src/modules/spaces/routes/spaces.controller.e2e-spec.ts`
- `src/modules/users/domain/users.repository.integration.spec.ts`
- `src/modules/notifications/domain/v2/test.notification.repository.module.ts`

## Database And Migrations

Observed patterns:

- Product-owned TypeORM entities live in module datasources, for example
  `src/modules/users/datasources/entities` and
  `src/modules/spaces/datasources/entities`.
- TypeORM modules are wired with `TypeOrmModule.forFeature(...)` in the product
  module when repositories need those entities.
- Repository methods use `PostgresDatabaseService` for repositories and
  transactions.
- Migrations are timestamped files in `migrations/`.
- Recent uniqueness work uses lifecycle-aware partial indexes when nullable
  identity is involved, for example `idx_users_ext_user_id` with
  `WHERE "ext_user_id" IS NOT NULL`.
- Domain repositories map uniqueness failures where a user-facing/domain error
  is expected, for example member invite handling maps unique violations to
  `UniqueConstraintError`.

## Initial Convention Candidates

These are not final rules yet, but they are strongly supported by the sampled
code and recent review feedback.

- Prefer one module per product/API concern.
- Put HTTP controllers and route orchestration under `routes/` unless the
  feature already has a versioned route convention.
- Put domain repositories, repository interfaces, and domain entities under
  `domain/`.
- Put feature-owned DB entities and feature-owned external API adapters under
  `datasources/`.
- Put shared infrastructure adapters under `src/datasources`.
- Keep route DTO classes with Swagger decorators under `routes/entities`.
- Keep Zod schemas close to the entity or route DTO they validate; use shared
  schemas from `src/validation` or `src/domain/common` when they already exist.
- Inject repositories and external APIs through symbol tokens.
- Batch related data lookups before DTO mapping instead of adding N+1 lookups
  in route services, repositories, or mappers.
- Avoid adding new `forwardRef` cycles without first checking whether module
  ownership can be simplified.
- Treat `safe-shield`, `csv-export/v1`, auth OIDC, and versioned
  notifications as special-case precedents, not default templates.

For option-by-option choices with code examples, see
`docs/engineering/working/open-question-options.md`.
