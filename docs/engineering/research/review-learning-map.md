<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Review Learning Map

Deprecated by `docs/engineering/review-learning-coverage.md`. Keep this file
only as a snapshot of the first manualization pass.

This file maps historical raw review-memory learnings into the first
engineering manual structure so stable rules could be promoted without losing
their source context.

## Source

- Raw source: historical manual review-memory source
- Last analyzed in source file: 2026-04-27
- Window in source file: since 2026-02-23
- PR range in source file: #2892-#3038

## Promotion Map

| Future manual page           | Review-learning sections to promote                                            |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `module-structure.md`        | Module & file layout, Reuse before duplicating, PR hygiene                     |
| `schemas-and-validation.md`  | Types & schemas, Controllers & guards                                          |
| `database-and-migrations.md` | Database & migrations, Reuse before duplicating                                |
| `auth-and-users.md`          | Authentication: SIWE and email users coexist, Naming, Reuse before duplicating |
| `testing.md`                 | Testing                                                                        |
| `config-and-secrets.md`      | Configuration, Module & file layout                                            |
| `observability.md`           | Logging                                                                        |
| `code-style.md`              | Naming, Code style, Biome / lint                                               |
| `code-conventions.md`        | Module & file layout, Reuse before duplicating, PR hygiene                     |
| `security.md`                | Security & redirect handling, Controllers & guards                             |

## High-Priority Seeds

These review learnings have broad impact and should be among the first rules
promoted into normative manual pages.

- Prefer the smallest correct change. Keep changed surface area small and avoid
  new abstractions unless they reduce current complexity, create a real
  boundary, are reused, or are needed for independent testing.
- New route families should use one NestJS module per concern instead of being
  bolted onto unrelated controllers.
- Zod schemas and reusable inferred types should live with entity/schema files,
  not inline inside services, repositories, verifiers, or controllers.
- Throwing helpers should use `assert*` or `*OrFail` names; boolean predicates
  used for branching should not throw.
- Use `Address` from `viem` and shared schemas from
  `src/validation/entities/schemas` before adding new address/hex/date/uuid
  validation.
- Validate external HTTP responses with Zod before use. Do not trust
  `Raw<T>` or cast external data into shape.
- Batch related lookups before DTO mapping. Avoid one repository/datasource
  lookup per item hidden inside a mapper.
- Do not duplicate guard logic inside controller methods.
- Validate route parameters and query parameters with existing schemas and
  `ValidationPipe`.
- SIWE and email/OIDC users coexist. Identity code must not assume every user
  has `signer_address`.
- DB writes should map uniqueness errors at the repository boundary.
- Nullable unique fields and lifecycle-limited uniqueness should use partial
  indexes or lifecycle-aware uniqueness.
- Multi-step status transitions should be atomic.
- Config values belong in `configuration.schema.ts` and should fail fast on
  invalid production configuration.
- Tests should use builders and existing fakes such as `FakeCacheService`
  instead of ad-hoc repeated literals or mocks.
- Logging levels should reflect operational actionability; expected denials are
  not `error`.
- Single-use DI abstractions are usually review friction. Do not add interfaces,
  factories, providers, or injection tokens for implementation details used by
  one class only.

## Research Follow-Ups

- Identify concrete "copy this" examples for each high-priority seed.
- Mark old or special-case code that violates a seed so agents do not copy it
  as precedent.
- Decide which learnings stay as broad review heuristics and which become hard
  local conventions.
