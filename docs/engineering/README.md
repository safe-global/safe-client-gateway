<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# CGW Engineering Manual

This manual captures CGW-local conventions. NestJS patterns are useful
vocabulary, but existing CGW modules, review history, and team decisions are
the source of truth.

## Layout

- `conventions/` — the canonical, ordered docs. Read these when writing code.
- `sources/` — what conventions are built from: the durable rule index
  (`rules.json`), the PR-sourced receipts (`examples/`), and `working/`
  (maintenance-only inputs).

## Read Before You Change

Before starting a coding task, read
[conventions/project-structure.md](conventions/project-structure.md). It
explains where files belong, which existing shapes are safe to copy, and which
local module patterns are special cases.

When a topic-specific conventions doc exists, prefer it over the per-rule
index:

- Testing — [conventions/testing.md](conventions/testing.md)

Before opening or finishing a PR, run `/safe-code-review` from the
[safe-engineering-plugin](https://github.com/safe-global/safe-plugins-marketplace/tree/main/plugins/engineering/safe-engineering-plugin).
Its team-rules pass checks the change against every rule in
[sources/rules.json](sources/rules.json).

## Task Routing

Adding or moving a module, controller, service, repository, datasource, DTO, or
schema:

- Read [conventions/project-structure.md](conventions/project-structure.md).
- Run every rule in `sources/rules.json`; pay particular attention to `MOD-*`,
  `TYPE-*`, and `TEST-*` rows.

Adding or changing database entities, migrations, uniqueness, or status flows:

- Read the Database And Migrations section in
  [conventions/project-structure.md](conventions/project-structure.md#database-and-migrations).
- Run every rule in `sources/rules.json`; pay particular attention to `DB-*`
  and `CONFIG-*` rows.

Adding or changing auth, users, spaces, members, wallets, or identity flows:

- Read the copy examples and auth/module notes in
  [conventions/project-structure.md](conventions/project-structure.md#copy-these-examples).
- Run every rule in `sources/rules.json`; pay particular attention to `AUTH-*`,
  `ROUTE-*`, and `SEC-*` rows.

Adding or changing an external API call, cache behavior, queue payload, or
upstream response mapping:

- Read the Repositories And Datasources and Config And External State sections
  in [conventions/project-structure.md](conventions/project-structure.md#repositories-and-datasources).
- Run every rule in `sources/rules.json`; pay particular attention to `TYPE-*`,
  `CACHE-*`, `PERF-*`, and `TEST-*` rows.

Writing or refactoring tests at any layer:

- Read [conventions/testing.md](conventions/testing.md).
- The per-rule index for testing is in `sources/rules.json` under `TEST-*`;
  PR-sourced receipts are in
  [sources/examples/testing.md](sources/examples/testing.md).

## Active Manual Pages

- [conventions/project-structure.md](conventions/project-structure.md)
- [conventions/testing.md](conventions/testing.md)
- [sources/rules.json](sources/rules.json)

Maintenance inputs (review learnings, ledger, open-question options) live under
`sources/working/` and are updated by `/safe-repo-rules` from the
safe-engineering-plugin (`--compound` weekly, `--prune` every few weeks), not by
normal coding agents.
