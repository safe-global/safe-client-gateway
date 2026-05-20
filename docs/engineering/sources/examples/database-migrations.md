<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Database & Migration Examples

Concrete `Avoid` / `Prefer` shapes lifted from CGW PR review feedback. See
`../rules.json` for the durable rules.

## DB-05 — Do not use the recorded migration `id` as an array index

Source: PR #2804 (RL-20260506-007)

### Avoid

Slicing the migrations array by the last-run migration's `id`:

```ts
const last = await this.runHistoryRepo.findLastRunMigration();
const pending = migrations.slice(last?.id ?? 0); // id treated as index
for (const migration of pending) {
  await migration.run();
}
```

### Prefer

Filter by `id > last.id` so a non-contiguous numbering (gaps from deleted
deprecated migrations) does not silently truncate the slice:

```ts
const last = await this.runHistoryRepo.findLastRunMigration();
const lastId = last?.id ?? 0;
const pending = migrations.filter((m) => m.id > lastId);
for (const migration of pending) {
  await migration.run();
}
```

And add an integration test that exercises the gap case explicitly: a DB
that recorded `last.id = 15` while the on-disk migrations array has fewer
entries because earlier IDs were deleted.

### Why

The `slice(lastId)` form silently returns an empty array as soon as
deletes leave gaps in the numbering, so already-migrated installations
stop receiving new migrations and the bug only surfaces in production
weeks later. Filtering by `id > lastId` is honest: the slice start is the
ID, not the array position.

## DB-05 — Migration metadata is reviewed, not copy-pasted

Source: PR #2870 (RL-20260116-001)

### Avoid

Copying a migration template across campaigns and silently flipping a
metadata field that drives reporting/ownership:

```sql
-- migration N — Outreach 5
INSERT INTO outreach (..., team_name, ...) VALUES (..., 'Core Experience', ...);

-- migration N+12 — Outreach 7 (described as "update existing campaign")
INSERT INTO outreach (..., team_name, ...) VALUES (..., 'Wallet', ...);
-- team_name flipped: not an update of the existing campaign anymore
```

### Prefer

When a migration is described as an update of an existing campaign,
preserve the ownership/reporting metadata from the previous migration
unless the change is intentional and called out in the PR description:

```sql
INSERT INTO outreach (..., team_name, ...) VALUES (..., 'Core Experience', ...);
```

If the team really is changing, say so in the PR body and in a comment
above the column, since downstream reports key off this field.

### Why

Migration files are append-only ground truth, and `team_name` style fields
feed dashboards or routing rules that nobody re-reviews. A copy-paste from
a different template is invisible in the diff context but rewrites who
owns the outreach. Reading every metadata column in a migration against
the previous run is cheap; recovering attribution after a release is not.
