---
description: Scaffold a datasource for an upstream API (interface + Symbol token + service + cache wiring + specs).
argument-hint: <module> <upstream API name>
---

Scaffold a datasource in `safe-client-gateway`: $ARGUMENTS

Load these first and follow them rather than anything you remember:

- `cgw-performance` skill → `docs/agents/caching-and-performance.md` (the new-cached-call recipe, TTLs, invalidation)
- `cgw-module-structure` skill → `docs/agents/module-structure.md` (placement, Symbol-DI recipe, naming)
- `cgw-api-dtos` skill → `docs/agents/api-dtos-and-validation.md` (`Raw<T>`, where `Schema.parse()` happens, error funnel)
- `cgw-config` skill → `docs/agents/configuration-and-flags.md` (base URL, TTL, and timeout keys)

Then:

1. **Placement.** A client for a *feature's* upstream API goes in that module's own `datasources/` (e.g. `src/modules/balances/datasources/coingecko-api.service.ts`). `src/datasources/` is cross-cutting infrastructure only — do not add a feature API client there.
2. **Read the nearest existing sibling datasource** and match it. Interface + Symbol token in one `*.interface.ts`, implementation in `*.service.ts`, entities and schemas beside them.
3. **Never call `fetch` or an HTTP client directly.** Outbound calls go through `INetworkService` / `CacheFirstDataSource` — otherwise the change silently loses logging, the circuit breaker, timeouts, and the error funnel.
4. **Return `Raw<T>`, do not parse.** The owning repository calls `Schema.parse()`; a datasource that parses has taken the repository's job.
5. **If the call is cached, the whole recipe lands in this change:** a `CacheRouter` getter for the key, `CacheFirstDataSource` with a TTL read from config (never a literal) and a `notFoundExpireTimeSeconds`, a `clear*()` on every write path that invalidates it, and `EventCacheHelper` wiring if an upstream event should invalidate it. A cached read with no invalidation is not a smaller change — it is an incomplete one.
6. **Errors** go through `HttpErrorFactory` / `DataSourceError`, not raw exceptions.
7. **Keep it provider-generic.** The client speaks one provider's protocol — request shape, batching, timeouts, retries. A domain rule inside it belongs in the calling service instead.
8. **Config keys** are named by topic, not by service (`billing`, not `billingServiceApi`), with TTLs as `*TtlSeconds`. Declare each in `configuration.ts` *and* `RootConfigurationSchema`, add to `.env.sample.json`, mirror in `__tests__/configuration.ts`, then run `yarn env:validate`.
9. **Specs:** `*.spec.ts` with a mocked `INetworkService`, builders + faker for payloads, and `FakeConfigurationService` rather than a hand-rolled config double.
10. **SPDX header** on every new file.

Finish with `yarn format`, `yarn lint --fix`, `yarn test <paths>` and report the real output.
