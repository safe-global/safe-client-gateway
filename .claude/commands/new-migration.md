---
description: Guide a schema change through the entity + migration flow, including the same-migration index rule.
argument-hint: <MigrationName> <what the schema change is>
---

Create a database migration in `safe-client-gateway`: $ARGUMENTS

Load the `cgw-database` skill → `docs/agents/database-and-migrations.md` first, and `cgw-api-dtos` → `docs/agents/api-dtos-and-validation.md` if the change alters a shape that is also served over the API.

1. **Change the entity first.** TypeORM entities live at `<module>/datasources/entities/*.entity.db.ts`, `implements` their domain type, and have a paired `RowSchema`. The entity and the migration must describe the same end state.
2. **Generate or create the migration.**
   - `yarn migration:generate <Name>` derives it from the entity diff — requires a built `dist/` and a reachable database.
   - `yarn migration:create <Name>` produces an empty one to fill in by hand. Use this when the change needs data movement, a backfill, or anything the generator cannot infer.
3. **Read the generated SQL and rewrite it if needed.** Migrations here are raw SQL and are reviewed as SQL — generator output is a draft, not the deliverable.
4. **Every foreign-key column and every column a query filters on gets a `CREATE INDEX` in this same migration.** No exceptions, no follow-ups: `wallets.user_id` shipped without one and was indexed roughly 15 months later (#2144). If you added a `WHERE` target anywhere in this change, it needs an index here.
5. **Write `down` so it actually reverts** — including dropping the indexes `up` created.
6. **SPDX header** in SQL comment style where the file is `.sql`: `-- SPDX-License-Identifier: FSL-1.1-MIT`; `// SPDX-License-Identifier: FSL-1.1-MIT` for the TypeScript migration class.
7. **The four representations.** A persisted-shape change is not done until all four are updated: the domain Zod schema, the `.entity.db.ts` + this migration, the route DTO classes, and the test builder.
8. **Caches.** A TypeORM query-cache id is a cache — if this change makes an existing cached query's result stale, invalidate it on every write path.
9. **Integration specs hand-construct repositories.** If this change adds a repository constructor parameter, grep `new <Repo>(` across every `*.integration.spec.ts` and update all of them — CI's typecheck and build skip spec files, so nothing else catches it.

Then run `yarn format`, `yarn lint --fix`, and the relevant specs. State in the PR body's `## Risk` section whether the migration is reversible and what the rollback path is.
