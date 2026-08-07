<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

`src/domain/` is a frozen tree. New feature code goes in `src/modules/<kebab>/` following the canonical
skeleton — read [docs/agents/module-structure.md](../../docs/agents/module-structure.md) before adding or moving
anything here.

Editing an existing repository: datasources return `Raw<T>`, and the owning repository must `Schema.parse()`
that output before returning it as a domain entity — see
[docs/agents/api-dtos-and-validation.md](../../docs/agents/api-dtos-and-validation.md). Entities ending in
`.entity.db.ts` are TypeORM entities; changing one requires a migration
([docs/agents/database-and-migrations.md](../../docs/agents/database-and-migrations.md)).
