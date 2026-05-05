<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# CGW Engineering Manual

This manual captures CGW-local conventions. NestJS patterns are useful
vocabulary, but existing CGW modules, review history, and team decisions are
the source of truth.

## Current Status

The manual has an ID-based convention guide, a PR self-review checklist,
maintenance references for learning updates, and research notes for CGW module
patterns.

Maintenance references:

- [review-learning-coverage.md](review-learning-coverage.md)
- [open-question-options.md](open-question-options.md)

## Read Before You Change

Any code change:

- Read [code-conventions.md](code-conventions.md).
- Prefer the smallest correct change and keep changed surface area small.
- Before opening or finishing a PR, run
  [pr-self-review-checklist.md](pr-self-review-checklist.md).

Adding or moving a module, controller, service, repository, datasource, DTO, or
schema:

- Read [code-conventions.md](code-conventions.md).
- Read [research/module-inventory.md](research/module-inventory.md).
- For unresolved conventions, compare the choices in
  [open-question-options.md](open-question-options.md).

Adding or changing database entities, migrations, uniqueness, or status flows:

- Read the database notes in
  [research/module-inventory.md](research/module-inventory.md#database-and-migrations).

Adding or changing auth, users, spaces, members, wallets, or identity flows:

- Read the users/spaces/auth notes in
  [research/module-inventory.md](research/module-inventory.md#candidate-canonical-modules).

Adding or changing an external API call:

- Read the datasource and repository notes in
  [research/module-inventory.md](research/module-inventory.md#observed-layer-responsibilities).

## Documentation Workflow

1. Capture recurring review findings and local patterns as research.
2. Promote stable patterns into short, normative manual pages.
3. Keep AGENTS.md small and route agents to the relevant page.
4. Mark legacy or special-case code explicitly so it is not copied
   accidentally.
5. Use [review-learning-coverage.md](review-learning-coverage.md) only when
   adding or updating convention learnings.

## Active Manual Pages

- `code-conventions.md`
- `pr-self-review-checklist.md`
- `open-question-options.md`

## Maintenance References

- `review-learning-coverage.md`
- `research/module-inventory.md`

## Candidate Manual Pages

- `module-structure.md`
- `schemas-and-validation.md`
- `database-and-migrations.md`
- `auth-and-users.md`
- `testing.md`
- `config-and-secrets.md`
- `observability.md`
