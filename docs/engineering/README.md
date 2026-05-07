<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# CGW Engineering Manual

This manual captures CGW-local conventions. NestJS patterns are useful
vocabulary, but existing CGW modules, review history, and team decisions are
the source of truth.

## Read Before You Change

Before starting a coding task, read
[project-structure.md](project-structure.md). It explains where files belong,
which existing shapes are safe to copy, and which local module patterns are
special cases.

Before opening or finishing a PR, generate the temporary checklist from
[rules.json](rules.json), review every rule, and mark every generated item
checked:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/code-conventions/scripts/generate-checklist.js
```

The generated checklist is ignored by Git and must not be committed.

## Task Routing

Adding or moving a module, controller, service, repository, datasource, DTO, or
schema:

- Read [project-structure.md](project-structure.md).
- Run every rule in `rules.json`; pay particular attention to `MOD-*`,
  `TYPE-*`, and `TEST-*` rows.

Adding or changing database entities, migrations, uniqueness, or status flows:

- Read the Database And Migrations section in
  [project-structure.md](project-structure.md#database-and-migrations).
- Run every rule in `rules.json`; pay particular attention to `DB-*` and
  `CONFIG-*` rows.

Adding or changing auth, users, spaces, members, wallets, or identity flows:

- Read the copy examples and auth/module notes in
  [project-structure.md](project-structure.md#copy-these-examples).
- Run every rule in `rules.json`; pay particular attention to `AUTH-*`,
  `ROUTE-*`, and `SEC-*` rows.

Adding or changing an external API call, cache behavior, queue payload, or
upstream response mapping:

- Read the Repositories And Datasources and Config And External State sections
  in [project-structure.md](project-structure.md#repositories-and-datasources).
- Run every rule in `rules.json`; pay particular attention to `TYPE-*`,
  `CACHE-*`, `PERF-*`, and `TEST-*` rows.

## Active Manual Pages

- [project-structure.md](project-structure.md)
- [rules.json](rules.json)
- [rules.generated.md](rules.generated.md)

Maintenance inputs (review learnings, ledger, open-question options) are kept
under `working/` and are updated by the convention-maintenance workflow, not by
normal coding agents.
