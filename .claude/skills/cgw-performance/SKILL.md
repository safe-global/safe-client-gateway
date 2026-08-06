---
name: cgw-performance
description: Use when a change in safe-client-gateway adds or modifies a cached read, a cache key, a TTL, an outbound upstream call, a datasource, a BullMQ job, or anything on a hot path. Covers the new-cached-call recipe (CacheRouter getter, CacheFirstDataSource with a config TTL and notFoundExpireTimeSeconds, clear*() on every write, EventCacheHelper wiring - all in one PR), the never-call-fetch-directly rule, Promise.all/allSettled over sequential awaits, batching to provider limits, and the small-single-concern-measured protocol for perf PRs. Triggers on "cache", "Redis", "TTL", "invalidate", "slow", "N+1", "timeout", "batch", "upstream call", "queue job".
---

# CGW Caching and Performance

Read **[docs/agents/caching-and-performance.md](../../../docs/agents/caching-and-performance.md)** before the change. This skill is a loader; the doc is the content.

Three non-negotiables from [AGENTS.md](../../../AGENTS.md) live here:

- **Never call `fetch` or an HTTP client directly.** Outbound calls go through `INetworkService` / `CacheFirstDataSource`, or they silently lose logging, the circuit breaker, timeouts, and the error funnel.
- **Cache keys only via `CacheRouter`; TTLs only from config.** A hard-coded timeout, batch size, or TTL is a review finding.
- **A cache write and its invalidation land in the same PR.** The getter, the read, every `clear*()`, and the `EventCacheHelper` wiring are one change. Raising a TTL without invalidation is a deliberate, stated trade-off, not a default.

Perf PRs follow their own protocol: small, single-concern, and measured. A 19-file perf refactor here (#2926) was reverted the same day (#3034) because the one bad change could not be separated from the good ones.

Also load **cgw-remarks** — R-020 (bypassing `NetworkService`), R-021 (cache write with no invalidation), and R-022 (sequential or partial cache clears) are the recurring shapes.
