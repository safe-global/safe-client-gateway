---
name: cgw-remarks
description: Lookup table of this repo's 30 recurring review remarks (R-001 onward), each quoted from real safe-client-gateway PR feedback. This is the supporting catalog that cgw-review consults, not the review standard itself - load it alongside cgw-review, or on its own to look up one specific pattern. Indexed by the shape a mistake takes in a diff - redundant `as unknown` mock casts, `as never`, mocking config instead of FakeConfigurationService, literal test data, `.mock.calls` assertions, `unknown` in public signatures, optional-vs-nullable DTO mismatches, inline interfaces and helpers, mechanism-flavored names, config keys named by service, bypassing NetworkService, cache writes with no invalidation, info-level event logs, missing authorization assertions, unvalidated env vars, deferred convention fixes, multi-concern PRs, unpinned actions. Triggers on "what will reviewers flag", "common issues here", "nitpicks", "is this the convention", or a question about one specific recurring pattern.
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
