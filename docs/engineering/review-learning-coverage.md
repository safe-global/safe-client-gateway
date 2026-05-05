<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Review Learning Coverage

This map shows how review learnings are covered by generalized rules and
checklist items. Concrete PRs and files are evidence, not rules.

## Source Windows

Use the source ID in coverage rows instead of repeating raw file links.

| Source ID | Source | Window | Signal |
| --- | --- | --- | --- |
| HIST-2026-04-27 | Historical manual review-memory source | Historical review-memory file, last analyzed 2026-04-27 | Broad rule seed |
| BACKFILL-2026-04-28-2026-05-05 | Closed PR comments | 2026-04-28T11:48:12Z..2026-05-05T13:48:12Z, 12 PRs, 189 comments | New-structure backfill |
| BACKFILL-2026-02-05-2026-04-28 | Closed PR comments | 2026-02-05T00:00:00Z..2026-04-28T11:48:12Z, 115 PRs, 865 comments | Historical backfill |

## Coverage Map

| Source learning | Generalized rules | Checklist coverage | Evidence |
| --- | --- | --- | --- |
| Keep changed surface small; avoid unnecessary providers/factories/helpers. | CHANGE-01, MOD-03, PR-01 | Scope, Module And Layering | HIST-2026-04-27, PR #3036 |
| Split unrelated work and docs/tooling edits from feature PRs. | CHANGE-02, PR-02 | Scope | PR #3036, PR #3030 |
| Tooling migrations must preserve previous guardrails and document gaps. | CHANGE-03, PR-02 | Scope | PR #3030 |
| Released route contracts need versioning or backward-compatible transitions; WIP endpoints can change in place only when that context is explicit. | CHANGE-04 | Scope | BACKFILL-2026-02-05-2026-04-28, PR #2905, PR #2914 |
| New route/product behavior belongs in the right module shape. | MOD-01 | Module And Layering | module inventory |
| Services should not know persistence/email uniqueness internals. | MOD-02, DB-04 | Module And Layering; Database, Config, And Dependencies | PR #3066 |
| Interface methods should not expose private helper behavior. | MOD-04 | Module And Layering | PR #3066 |
| Avoid expanding `forwardRef` cycles. | MOD-05 | Module And Layering | module inventory, HIST-2026-04-27 |
| Route services should not call datasources directly or own external-data validation/fallbacks. | MOD-06, PERF-01 | Module And Layering; Performance And Batching | BACKFILL-2026-02-05-2026-04-28, module inventory |
| Names should reveal behavior: throwing helpers, DTOs, errors, tests, and scoped methods. | NAME-01 | Naming, Reuse, And Style | HIST-2026-04-27 |
| Constants, cache helpers, error normalization, and grouping utilities should reuse local homes. | REUSE-01, CACHE-01, LOG-04 | Naming, Reuse, And Style; Database, Config, And Dependencies; Tests And Logs | HIST-2026-04-27 |
| Public/non-trivial service and repository code should be explicit, documented, and free of dead branches. | STYLE-01, DB-03 | Naming, Reuse, And Style; Database, Config, And Dependencies | HIST-2026-04-27 |
| Use `Address`, `Hex`, and shared schemas instead of ad-hoc types. | TYPE-01 | Types And Schemas | PR #3061, HIST-2026-04-27 |
| Zod schemas belong in entity/schema files, not inline implementation files. | TYPE-02 | Types And Schemas | PR #3036 |
| Validate token claims, external responses, queued jobs, and config strings. | TYPE-03, CONFIG-02, TEST-04 | Types And Schemas; Database, Config, And Dependencies; Tests And Logs | PR #3039, PR #3065 |
| DTO fields must reflect exact API exposure, optionality, and nullability. | TYPE-04, AUTH-04 | Types And Schemas; Auth, Data, And Routes | PR #3037 |
| Parser/decode generics must cover the full shape consumed. | TYPE-05 | Types And Schemas | PR #3036 |
| Avoid unsafe casts and runtime drift against upstream packages. | TYPE-06 | Types And Schemas | PR #3061 |
| Auth assertions and predicates should be reused instead of reimplemented. | AUTH-01 | Auth, Data, And Routes | HIST-2026-04-27, module inventory |
| Auth flows must support SIWE and OIDC/email users. | AUTH-02, AUTH-04 | Auth, Data, And Routes | HIST-2026-04-27, PR #3037 |
| Prefer `jose`/maintained libraries for JWKS/JWT work. | AUTH-03 | Auth, Data, And Routes | PR #3036 |
| Unique constraints, status transitions, and races need lifecycle-aware handling. | DB-01, DB-02, DB-03, DB-04 | Database, Config, And Dependencies | HIST-2026-04-27, PR #3066 |
| Migrations, TypeORM entities, enum transformers, FK/index choices, rollback assumptions, and repository integration tests need to agree. | DB-05 | Database, Config, And Dependencies | BACKFILL-2026-02-05-2026-04-28, PR #2998, PR #3055 |
| Redis pipelines and cache marker writes must validate every meaningful result. | CACHE-01 | Database, Config, And Dependencies | HIST-2026-04-27 |
| Cache key builders, bounded in-memory caches, and expiry refresh behavior need collision/TTL tests. | CACHE-02, TEST-09 | Database, Config, And Dependencies; Tests And Logs | BACKFILL-2026-02-05-2026-04-28, PR #2937, PR #3069 |
| Defaults should remain conservative and OSS-generic. | CONFIG-01 | Database, Config, And Dependencies | PR #3036, PR #3039, PR #3063 |
| Config values and config tests belong in the canonical schema/test locations. | CONFIG-02 | Database, Config, And Dependencies | HIST-2026-04-27, PR #3039 |
| TTLs/timeouts/cache settings should be config. | CONFIG-03 | Database, Config, And Dependencies | PR #3036 |
| Runtime dependency versions should be exact. | CONFIG-04 | Database, Config, And Dependencies | PR #3061, PR #3036 |
| Toolchain versions, Docker build args, pinned CI actions, and `.env.sample.json` required flags should not drift from runtime behavior. | CONFIG-05, PR-02 | Database, Config, And Dependencies; Scope | BACKFILL-2026-02-05-2026-04-28, PR #3007, PR #2994 |
| Controllers remain HTTP boundaries and validate inputs. | ROUTE-01, ROUTE-02, ROUTE-03 | Auth, Data, And Routes | HIST-2026-04-27 |
| Redirect/callback targets need strict validation of protocol, domain, credentials, and ports. | SEC-01, TEST-04 | Security-Sensitive Inputs; Tests And Logs | HIST-2026-04-27 |
| Unverified tokens, API keys, secrets, encrypted material, and raw upstream payloads need narrow trust and exposure boundaries. | SEC-02, TYPE-03, LOG-04 | Security-Sensitive Inputs; Types And Schemas; Tests And Logs | BACKFILL-2026-02-05-2026-04-28, PR #2994, PR #2944, PR #2982 |
| List mapping and hot paths should batch lookups, avoid repeated upstream/API calls, cap limits, and keep independent calls parallel. | PERF-01, DB-03 | Performance And Batching; Database, Config, And Dependencies | BACKFILL-2026-02-05-2026-04-28, PR #2915, PR #2982, PR #3066 |
| Tests should use builders/fakes and avoid implementation-coupled mocks. | TEST-01, TEST-03 | Tests And Logs | PR #3066 |
| Use the right test layer; avoid DB seeding in e2e for unit-level concerns. | TEST-02 | Tests And Logs | PR #3037 |
| Security-sensitive paths need negative-path coverage. | TEST-04 | Tests And Logs | PR #3065 |
| Test setup/cleanup should be scoped, not global workaround cleanup. | TEST-05 | Tests And Logs | PR #3065, PR #3066 |
| Test fixtures should fail loudly when required deployments are absent. | TEST-06 | Tests And Logs | PR #3061 |
| Implementation selection changes need full-pipeline coverage. | TEST-07 | Tests And Logs | PR #3061 |
| Test descriptions and generated data should reflect the actual assertion. | TEST-08, NAME-01 | Tests And Logs; Naming, Reuse, And Style | HIST-2026-04-27 |
| Edge cases, observability calls, cache invalidation branches, production/default config branches, and deterministic ordering need tests when they are part of the behavior. | TEST-09 | Tests And Logs | BACKFILL-2026-02-05-2026-04-28, PR #2897, PR #2994, PR #3069 |
| Expected business outcomes and hot worker events should not be noisy logs. | LOG-01, LOG-02 | Tests And Logs | PR #3039, PR #3036 |
| Closed-unmerged observability work can reveal cost/benefit limits. | LOG-03 | Tests And Logs | PR #3022 |
| Structured logs should use `LogType`, and caught values should use `asError`. | LOG-04 | Tests And Logs | HIST-2026-04-27 |

## Coverage Gaps

- Several historical review-memory bullets are now covered by broad
  rule IDs but do not yet have per-rule "copy this" code examples.
- Module-layout choices captured in `docs/engineering/open-question-options.md`
  should not be promoted to hard rules until the team chooses an option.
