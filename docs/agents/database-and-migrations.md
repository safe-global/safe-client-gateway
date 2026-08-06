<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Database and Migrations

This guide sets the rules for Postgres schema changes, TypeORM entity code, and the query patterns built on top of them in CGW. The persistence mechanism itself — the TypeORM migrator, `synchronize: false`, connection setup, and the separate ORM query cache — is described in `docs/agents/ARCHITECTURE.md`'s Persistence section; this guide states the normative rules for writing a migration, an entity, or a query against it.

### Index in the same migration

**Rule:** A migration that adds a foreign-key column, or any column a query filters or sorts by, adds the matching `CREATE INDEX` in that same migration — whether the column lands on a brand-new table or is added to an existing one. Postgres automatically indexes a `PRIMARY KEY`/`UNIQUE` column, but never a plain foreign key. When a column already exists without an index and only later becomes a filter/sort target, ship a standalone migration containing nothing but the missing `CREATE INDEX` — never leave it for an unrelated migration to add incidentally.

**Why:** `wallets.user_id`'s foreign key was created with no index in `migrations/1737473344288-create_wallets.ts`, and only indexed roughly 15 months later in `migrations/1777637000000-add-wallets-user-id-index.ts`. PR #2144 separately retro-added six more missing indexes across `accounts`, `counterfactual_safes`, `targeted_safes`, and `submissions`.

**Canonical example:** `migrations/1779100947599-create-surveys.ts` creates `survey_responses` with a `survey_id` foreign key and, in the same migration, `CREATE INDEX "idx_survey_responses_survey" ON "survey_responses" ("survey_id")`. `migrations/1781200000000-create-space-audit-log.ts` does the equivalent for a query-shaped, non-FK column, indexing the exact `("space_id", "created_at", "id")` triple its one read path filters and orders by, in the same migration that creates the table.

The eventual fix for the `wallets` gap was itself a single, minimal migration — nothing more than the missing index:

```ts
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(
    `CREATE INDEX "idx_wallets_user_id" ON "wallets" ("user_id")`,
  );
}
```

### Raw SQL migrations only

**Rule:** A schema change ships as a new file under `migrations/` implementing TypeORM's `MigrationInterface`, with the change written as raw SQL in `up()` and its exact inverse in `down()`. Never rely on TypeORM's `synchronize`, and never run DDL by hand against any environment.

**Why:** a migration file is the one change record every environment and TypeORM's own migrator agree on; an entity-driven auto-sync or a hand-run DDL statement leaves no such record and lets environments silently diverge from each other.

**Canonical example:** `migrations/1737473344288-create_wallets.ts` — `up()` runs a `CREATE TABLE` and an `ALTER TABLE ... ADD CONSTRAINT` through `queryRunner.query`, and `down()` runs the exact inverse, `ALTER TABLE ... DROP CONSTRAINT` then `DROP TABLE`. Every file under `migrations/` follows this same paired-raw-SQL shape, and its class name mirrors the filename's leading timestamp (`CreateWallets1737473344288`, `AddWalletsUserIdIndex1777637000000`) rather than being chosen freely.

The migrator that runs these files on startup — its retry behaviour, and the `_migrations` tracking table name — is the mechanism documented in `docs/agents/ARCHITECTURE.md`'s Persistence section; this rule governs only the shape of the migration file itself.

### Entity placement and compile-time sync

**Rule:** A TypeORM entity class lives only at `src/modules/<module>/datasources/entities/*.entity.db.ts`, `implements` the corresponding domain type — the `z.infer` of that module's Zod entity schema — and, where it represents a persisted row, that domain schema extends the shared `RowSchema` (`src/datasources/db/v2/entities/row.entity.ts`) rather than redeclaring `id`/`createdAt`/`updatedAt` itself. Join/junction tables vary in today's code; new ones follow the full RowSchema pattern.

**Why:** the `implements` clause is what makes the compiler the DB↔domain sync mechanism: a field added to, or removed from, the domain schema without a matching change to the entity class fails to compile instead of surfacing later as a runtime mismatch.

**Canonical example:** `src/modules/users/datasources/entities/users.entity.db.ts`'s `class User implements DomainUser` pairs with `UserSchema = RowSchema.extend({ ... })` in `src/modules/users/domain/entities/user.entity.ts`, so the `id`/`createdAt`/`updatedAt` triple is defined once, in `RowSchema`, and inherited rather than repeated per entity. See `docs/agents/module-structure.md`'s File naming rule for the `.entity.db.ts` suffix convention itself.

An `@Index()` decorator on an entity column, such as the same file's `idx_user_status`, is metadata only: with `synchronize` always `false` (see Raw SQL migrations only, above), decorating a column does not create the index, so the migration that adds the column still needs its own `CREATE INDEX` to match (see Index in the same migration, above).

### No `SELECT *`

**Rule:** A raw-SQL datasource query names its columns explicitly. Never write a bare `SELECT *` against an application table.

**Why:** PR #2736 replaced `SELECT *` with explicit column lists across several raw-SQL datasources as part of a fix for memory leaks and query inefficiencies.

**Canonical example:** `src/modules/targeted-messaging/datasources/targeted-messaging.datasource.ts`'s `getOutreachOrFail` reads `SELECT target_all FROM outreaches WHERE id = ${outreachId}` — one named column — rather than the whole row.

This targets `SELECT`; an `INSERT`/`UPDATE`'s `RETURNING *` returns only the row the statement itself just wrote, not an arbitrary read of the table, and sits outside this rule.

### Query-cache pairing

**Rule:** A TypeORM `find`/`findOne` call that sets `cache: { id, milliseconds }`, and a `CachedQueryResolver.get` call (`src/datasources/db/v1/cached-query-resolver.ts`) wrapping a raw query, each need a paired cache-removal call on every top-level mutating entry point of that repository/datasource that writes — directly or through an internal helper — to any table the cached read's query touches, including joined relations; an internal helper that only ever runs inside an already-invalidated transaction does not need a separate call of its own.

**Why:** neither cache invalidates itself on a write. The TypeORM query cache has no automatic invalidation at all — see `docs/agents/ARCHITECTURE.md`'s Persistence section — and `CachedQueryResolver` sits on the same Redis cache `CacheFirstDataSource` uses, governed by `docs/agents/caching-and-performance.md`'s Invalidation via deleteByKey only rule. Either way, a cached read with no paired removal keeps serving a stale row for the rest of its TTL after a write that should have changed it.

**Canonical example:** `src/modules/notifications/domain/v2/notifications.repository.ts`'s `getSubscribersBySafe` calls `.find` with `cache: { id: subscriptionsCacheKey, milliseconds: cacheTtl }`; its private `removeGetSubscribersBySafeCache` is called from every one of the repository's top-level mutating entry points — `upsertSubscriptions`, `deleteSubscription`, `deleteAllSubscriptions`, and `deleteDevice`:

```ts
for (const safe of args.safes) {
  const subscriptionsCacheKey = this.getSubscribersBySafeCacheKey({
    chainId: safe.chainId,
    safeAddress: safe.address,
  });

  await args.entityManager.connection.queryResultCache?.remove([
    subscriptionsCacheKey,
  ]);
}
```

The `CachedQueryResolver` variant: `src/modules/targeted-messaging/datasources/targeted-messaging.datasource.ts`'s `getTargetedSafe`/`getSubmission` read through `this.cachedQueryResolver.get`, keyed by `CacheRouter.getTargetedSafeCacheDir`/`getSubmissionCacheDir`; the mutating `createTargetedSafes`/`createSubmission` each call `this.cacheService.deleteByKey` on the narrower `CacheRouter.getTargetedSafeCacheKey`/`getSubmissionCacheKey` right after their write.

### The integration-spec constructor sweep

**Rule:** The standing sweep for a change to a repository's constructor parameters is `grep -rn "new <RepoClass>(" src --include='*.integration.spec.ts'`; every call site the grep returns gets updated to match before the change is complete.

**Why:** `*.integration.spec.ts` files hand-construct the repositories they exercise with `new`, rather than resolving them through Nest's DI container, and `tsconfig.build.json` excludes every spec file (`**/*spec.ts`, `**/__tests__/*`) from the typecheck it runs — so a green build confirms nothing about whether these call sites still compile. `test:integration` (a separate CI job from `test:unit`) is where an un-swept constructor change actually surfaces, as a test-run failure rather than a build failure.

**Canonical example:** `grep -rn "new WalletsRepository(" src --include='*.integration.spec.ts'` returns several call sites across multiple files — its own `wallets` spec, plus `users`, `users/members`, and `spaces/audit` — which is why the sweep greps all of `src` rather than only the changed repository's own module.

### Pagination

**Rule:** A paginated domain schema is built with `buildPageSchema(ItemSchema)` — or `buildLenientPageSchema` where one invalid upstream record should not fail the whole page — from `src/domain/entities/schemas/page.schema.factory.ts`. A route exposes a concrete `class XPage extends Page<X>` for Swagger. A route reads a cursor only through `PaginationData` (`src/routes/common/pagination/pagination.data.ts`); limit/offset parsing is never hand-rolled at the call site.

**Why:** Swagger cannot generate a model definition from a bare generic, so `Page<T>` requires a concrete per-item subclass at every call site; centralizing cursor parsing in `PaginationData` is what keeps every paginated route sharing the same `DEFAULT_LIMIT`/`DEFAULT_OFFSET` fallback and the same handling of a missing or non-numeric value, instead of each route reimplementing it slightly differently.

**Canonical example:** `src/modules/chains/routes/entities/chain-page.entity.ts`'s `class ChainPage extends Page<Chain>` declares `@ApiProperty({ type: Chain, isArray: true }) results!: Array<Chain>`. Cursor parsing goes through `PaginationData.fromCursor`/`.fromLimitAndOffset`, each falling back to `PaginationData.DEFAULT_LIMIT`/`DEFAULT_OFFSET` when the query value is missing or not a number.

`buildPageSchema` backs the domain page schema of most paginated resources in the codebase — transfers, module transactions, and multisig transactions among them; a route that needs to tolerate one malformed item without failing the whole listing uses `buildLenientPageSchema` instead, never a hand-written `try`/`catch` around the item parse.

The schema-factory mechanism (`buildPageSchema`/`buildLenientPageSchema` wrapping the `{count, next, previous, results}` envelope) is described in `docs/agents/ARCHITECTURE.md`'s Validation model section; this rule states what a route uses and exposes.
