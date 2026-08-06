---
name: cgw-database
description: Use when writing a migration, adding or changing a TypeORM entity (*.entity.db.ts), or writing a database query in safe-client-gateway. Covers the raw-SQL migration convention, the rule that every foreign-key and WHERE-target column gets a CREATE INDEX in the same migration, no SELECT *, entity placement under datasources/entities/ with implements DomainX plus a RowSchema, TypeORM query-cache IDs needing paired invalidation on every write, and the integration-spec footgun where adding a repository constructor param breaks hand-constructed repos that the build typecheck does not cover. Triggers on "migration", "new table", "add a column", "index", "TypeORM", "entity.db", "SQL query", "database".
---

# CGW Database and Migrations

Read **[docs/agents/database-and-migrations.md](../../../docs/agents/database-and-migrations.md)** before writing a migration or a query. This skill is a loader; the doc is the content.

Two rules with a real cost behind them:

- **Every FK column and every column a query filters on gets a `CREATE INDEX` in the same migration.** `wallets.user_id` shipped without one and was indexed ~15 months later (#2144).
- **Adding a constructor parameter to a repository breaks `*.integration.spec.ts` at runtime only.** Those specs hand-construct repositories, and CI's typecheck and build skip spec files — so nothing catches it until the integration job runs. Grep `new <Repo>(` across every `*.integration.spec.ts` and update all of them.

A TypeORM query-cache id is a cache: it needs paired invalidation on every write path, the same way `CacheRouter` keys do. Migrations are raw SQL, they carry the SPDX `--` header, and `SELECT *` is not used.

Working inside `migrations/` auto-loads the pointer stub at `migrations/AGENTS.md`, which routes here.
