---
name: cgw-remarks
description: Use when reviewing a diff in safe-client-gateway, or before opening a PR, to preempt the review comments this repo raises over and over. A numbered catalog (R-001 onward) of 30 real recurring remarks drawn from actual PR feedback - redundant `as unknown` mock casts, `as never`, mocking config instead of FakeConfigurationService, literal test data, `.mock.calls` assertions, `unknown` in public signatures, optional-vs-nullable DTO mismatches, inline interfaces and helpers, mechanism-flavored names, config keys named by service, bypassing NetworkService, cache writes with no invalidation, info-level event logs, missing authorization assertions, unvalidated env vars, deferred convention fixes, multi-concern PRs. Triggers on "review this", "common issues", "what could go wrong", "what will reviewers say", "nitpicks".
---

# CGW Recurring Review Remarks

Read **[docs/agents/remarks.md](../../../docs/agents/remarks.md)** — the catalog. This skill is a loader; the doc is the content.

Each entry is `R-NNN` with **Pattern** (what to look for in a diff), **Why it's bad**, **Corrected form**, **Spotted in** (the real PRs), and **Status** (`active` / `solved-by-biome` / `retired`). Numbers are permanent.

Scan by section against what your diff touches:

| Section | Entries |
|---|---|
| Tests | R-001 … R-008 |
| Types | R-009 … R-012 |
| Structure | R-013 … R-016 |
| Naming | R-017 … R-019 |
| Caching and upstream calls | R-020 … R-022 |
| Logging and errors | R-023 … R-025 |
| Hygiene | R-026 … R-030 |

This is a lookup table, not a rule source — where a remark restates a rule another guide owns, the entry links there. Use it alongside **cgw-review**, which carries the review standard itself.

A remark earns an entry once raised on two different PRs, or twice on one PR against different code. The doc's "Adding an entry" section has the process.
