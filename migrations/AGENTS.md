<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

Writing a migration? Read [docs/agents/database-and-migrations.md](../docs/agents/database-and-migrations.md) first.
Non-negotiable: every FK/WHERE-target column gets `CREATE INDEX` in the SAME migration — Postgres does not auto-index FKs.
