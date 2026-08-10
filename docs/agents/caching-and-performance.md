<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Caching and Performance

This guide sets the rules for outbound calls, caching, and hot paths in CGW: what a new cached call must ship with, when work moves off the request path onto a queue, and where concurrency is mandatory rather than optional. The caching mechanism itself — `CacheFirstDataSource`, `CacheDir`, TTL jitter, and event-driven invalidation — is described in `docs/agents/ARCHITECTURE.md`'s Caching section; this guide states the normative rules for using it.

### New cached call recipe

**Rule:** A new cached upstream call ships all of the following in the same PR: a static cache-directory getter in `src/datasources/cache/cache.router.ts` (plus a separate static key getter there when `clear*()`/event invalidation needs the key from a narrower parameter set than the directory's — e.g. `getMultisigTransactionsCacheKey` alongside `getMultisigTransactionsCacheDir`); a `CacheFirstDataSource.get`/`.post` call whose `expireTimeSeconds` and `notFoundExpireTimeSeconds` are both sourced from configuration; a `clear*()` method on the owning datasource that calls `cacheService.deleteByKey`; and, when the cached data changes as a result of a Transaction Service event, a corresponding entry in the event-cache mapping in `EventCacheHelper` (`src/modules/hooks/domain/helpers/event-cache.helper.ts`).

**Why:** each piece closes a different gap — skipping the CacheRouter getters reopens the ad hoc-key problem the next rule exists to prevent; skipping the negative-caching TTL means a 404 is re-requested upstream on every call instead of once per window; skipping `clear*()` leaves the entry with no invalidation path before its TTL expires on its own schedule; and skipping the event-cache mapping in `EventCacheHelper` means a change on the Transaction Service side never reaches this cache, so callers keep seeing the stale value until natural expiry.

**Canonical example:** `src/modules/transactions/datasources/transaction-api.service.ts` — `getMultisigTransactions` builds its `CacheDir` from `CacheRouter.getMultisigTransactionsCacheDir` and sources `expireTimeSeconds`/`notFoundExpireTimeSeconds` from `this.defaultExpirationTimeInSeconds`/`this.defaultNotFoundExpirationTimeSeconds` (themselves read from `expirationTimeInSeconds.default`/`.notFound.default`); `clearMultisigTransactions` resolves the key with `CacheRouter.getMultisigTransactionsCacheKey` — the narrower `{chainId, safeAddress}` getter — and calls `cacheService.deleteByKey` on it, and the executed- and pending-multisig-transaction branches of the event-cache mapping in `EventCacheHelper` call it.

The key/TTL/clear pieces of this recipe are each covered in more depth in the rules immediately below — CacheRouter placement next, TTL sourcing after that, invalidation after that. A PR is incomplete if it skips any of the first three, or skips the fourth when a Transaction Service event does affect the cached data.

### Keys only via CacheRouter

**Rule:** Never construct a `CacheDir` or a cache key string outside `src/datasources/cache/cache.router.ts`; a datasource that needs a new key shape adds a static getter there rather than inlining one at the call site.

**Why:** the central registry is what keeps invalidation auditable — a key built ad hoc at a call site is a key no `clear*()` method can be checked against, so nothing guarantees the read path and the invalidation path ever agree on the same string.

**Canonical example:** `src/datasources/cache/cache.router.ts` — the registry itself, including keys and fields derived from a hash rather than a literal: `CacheRouter.getContractAnalysisCacheDir`, `getDeadlockAnalysisCacheDir`, and `getRecipientAnalysisCacheDir` each compute a `sha256` digest of their inputs internally, so even a hash-keyed cache entry is computed inside the router, not by the datasource calling it.

The mechanism's own internal bookkeeping is the one exception: `CacheFirstDataSource` and `RedisCacheService` each build their own `invalidationTimeMs:<key>` marker directly, since that marker belongs to the cache mechanism itself and not to a feature datasource's key space.

### No literal TTLs

**Rule:** Every cache TTL comes from `expirationTimeInSeconds.*` in `src/config/entities/configuration.ts`, never a number literal at the call site; negative caching via `notFoundExpireTimeSeconds` is mandatory on every cached read, not an optional extra reserved for high-traffic endpoints.

**Why:** a literal TTL can only change with a deploy, while a configuration-sourced one is env-overridable at runtime without touching code; skipping negative caching turns every lookup of a resource that doesn't exist into a guaranteed upstream round trip on every single request for it, rather than one round trip per expiry window.

**Canonical example:** the `expirationTimeInSeconds` block in `src/config/entities/configuration.ts` — `.default`, `.rpc`, `.staking`, `.zerionPositions`, and others, plus the negative-caching group `.notFound.{default,contract,token}`, each backed by its own environment variable. A representative read: `src/modules/transactions/datasources/transaction-api.service.ts`'s constructor sources `expirationTimeInSeconds.default`, `.notFound.default`, and `.notFound.token` through `IConfigurationService.getOrThrow` into the fields its cached reads then pass as `expireTimeSeconds`/`notFoundExpireTimeSeconds`.

Grouping every TTL under one configuration namespace also keeps the rule mechanically checkable: every stored expiry is discoverable with one grep against `expirationTimeInSeconds`, rather than a search for scattered numeric literals across datasources.

### Invalidation via deleteByKey only

**Rule:** Delete a cached entry only through `cacheService.deleteByKey`; never issue a raw Redis `DEL`/`UNLINK`/etc. against a cache key from application code.

**Why:** `deleteByKey` stamps an `invalidationTimeMs` marker alongside the delete, and that marker is what a subsequent in-flight fetch checks before writing its result back. The race this closes is described in full in `docs/agents/ARCHITECTURE.md`'s Caching section; this rule is its normative form — a raw Redis command skips the marker and reopens the exact stale-write race that section documents.

This applies equally to a `clear*()` method's own delete and to a delete triggered from the event-cache mapping in `EventCacheHelper` (first rule above) — both are application code, and both are required to funnel through the same `cacheService.deleteByKey`.

### Independent awaits run concurrently

**Rule:** Independent async calls run through `Promise.all`/`Promise.allSettled`; no `await` sits inside a loop iterating over independent items.

**Why:** PR #1883 fixed exactly this in `NativeStakingMapper`, replacing sequential per-item awaits with `Promise.all`.

**Canonical example:** `src/modules/transactions/routes/mappers/common/native-staking.mapper.ts` batches its independent lookups through `Promise.all` throughout — e.g. `[chain, deployment, rewardsFee]` and `[publicKeys, nativeStakingStats, networkStats]` are each fetched as one concurrent group rather than one `await` at a time.

**Anti-example (do not imitate the pattern):** `src/modules/transactions/routes/mappers/common/twap-order.mapper.ts`'s `getPartOrders` awaits `swapsRepository.getFullAppData` and `swapsRepository.getOrder` inside a `for (const part of args.partsToFetch)` loop, one TWAP part at a time, even though each part's app data and order lookup are independent of every other part's.

Prefer `Promise.all` when any single failure should fail the whole call, and `Promise.allSettled` when one item's failure should not sink the rest — the batched price fetch in the next rule is the `allSettled` case.

### Batch and chunk upstream calls

**Rule:** Deduplicate inputs and chunk them before an upstream call goes out, to a size that respects the provider's documented per-request limit, with the chunk size a named, config-driven value rather than a number inlined at the call site.

**Why:** PR #836 batched multiple token prices into one Coingecko request instead of firing one request per token — an N+1 over HTTP; PR #2532 added the batch-size cap itself after an unbounded batch failed for a Safe holding a large number of tokens.

**Canonical example:** `src/modules/balances/datasources/coingecko-api.service.ts`'s `_requestPricesFromNetwork` lowercases and deduplicates token addresses through a `Set`, then splits the result into request-sized batches with lodash's `chunk` before fetching every batch concurrently through `Promise.allSettled`.

Batching shrinks the number of upstream calls; it does not change how any individual call is made — every batch request still goes through `INetworkService` with its normal timeout and circuit breaker (see the HTTP-resilience rule below).

### Heavy work goes to BullMQ

**Rule:** Heavy work — work whose duration scales with input size (an export, a multi-record job) or that cannot complete within a typical request's latency budget — is enqueued on a BullMQ queue with `attempts`, `backoff`, and `removeOnComplete`/`removeOnFail` all sourced from configuration; a request handler enqueues the job and returns, it does not perform the work inline.

**Why:** a job with no bound on retries or completed-job retention either retries a permanently-failing job forever or grows its Redis footprint without limit, and sourcing both from configuration keeps them tunable per environment without a code change.

**Canonical example:** `src/modules/csv-export/v1/csv-export.module.ts` registers the export queue via `BullModule.registerQueueAsync`, with `removeOnComplete`/`removeOnFail`/`backoff`/`attempts` all read from `csvExport.queue.*`; `src/modules/csv-export/v1/csv-export.controller.ts`'s `launchExport` only calls `CsvExportService.registerExportJob`, which enqueues the job and returns immediately rather than running the export inline.

The same config-driven `attempts`/`backoff`/retention shape is expected of every BullMQ queue in the codebase, not only the export one — a new queue that hardcodes any of the three is the same gap this rule closes, just at a different call site.

### Stream large payloads

**Rule:** A large output streams end-to-end from source to destination; it is never accumulated into an in-memory string or array first.

**Why:** an accumulated buffer holds the entire output in process memory at once, so memory use scales with the size of the export rather than with a fixed buffer independent of it.

**Canonical example:** `src/modules/csv-export/v1/csv-export.service.ts`'s `export` pipes an async-generator-backed `Readable` (`transactionPagesGenerator`) through `CsvService.toCsv` into the upload stream using Node's `stream/promises` `pipeline`; no page of transactions, and no complete export, is ever held as a single in-memory string or array.

The same discipline covers the stream's own error handling: `export` destroys the upload stream on a pipeline failure (`uploadStream.destroy(error)`) specifically so the other side of the pipe unwinds instead of hanging open.

### Bounded in-process memos

**Rule:** An in-memory memoization or cache is cron-cleared via `@Cron(..., { disabled: process.env.NODE_ENV === 'test' })` (the only shape in the codebase today; a size-bounded cache would satisfy the rule equally); the shared Redis-backed cache (`CacheFirstDataSource`/`RedisCacheService`) is preferred over adding a new ad hoc in-process memo.

**Why:** PR #2628 removed a method-level memoization cache that had no such bound.

**Canonical example:** `src/domain/common/entities/safe-signature.ts`'s `clearSignatureMemo` and `src/modules/hooks/domain/helpers/event-cache.helper.ts`'s `clearSupportedChainsMemo` each clear a lodash `memoize` cache on their own `@Cron` (hourly and every-30-seconds respectively), both disabled in tests via `NODE_ENV === 'test'`.

An in-process memo is appropriate only for a cheap, synchronous re-derivation — recovering a signer address, checking chain support — never as a substitute for `CacheFirstDataSource` in front of an actual upstream call.

### Listener and floating-promise hygiene

**Rule:** A stream or response listener is attached with `.once()`, or is explicitly removed once it has served its purpose; every floating promise — one neither awaited nor returned to a caller — ends in a `.catch()`.

**Why:** PR #2736 fixed listener-accumulation leaks that this rule exists to prevent; an unremoved listener or an unhandled floating rejection is the recurring shape that class of leak takes.

No single canonical file exists for this rule — it is call-site discipline across every stream, listener, and floating promise, not one owning module.

A promise a route handler returns to Nest's own request pipeline is not "floating" — the framework awaits it. The rule targets a background call kicked off inside a handler or consumer without being awaited or returned to any caller.

### No hand-rolled HTTP resilience

**Rule:** All outbound HTTP goes only through `INetworkService`; a datasource never adds its own retry loop around a network call.

**Why:** `INetworkService`'s default timeout and opt-in circuit breaker are described in `docs/agents/ARCHITECTURE.md`'s External services section; this rule is its normative form — a per-datasource retry loop duplicates what the circuit breaker already does on failure counting, and can turn a brief upstream blip into a retry storm against a service other callers are also depending on.

This applies whether the datasource is module-owned (`src/modules/*/datasources/`) or still central (`src/datasources/*-api/`) — the network path, and the ban on a local retry loop, is the same either way.

### Perf changes ship small and measured

**Rule:** A performance change is single-concern and ships with a measurement — a benchmark, a trace, a before/after metric; a multi-concern performance refactor is rejected in review and resubmitted as separate, independently reviewable PRs.

**Why:** a 19-file performance refactor (PR #2926) was reverted wholesale the same day (PR #3034); the ideas in it that did hold up landed only afterward, as isolated PRs each reviewable and revertible on their own.

No code canonical exists for a PR-shape rule; the git history in the Why above is the example.

"Measured" means a concrete before/after number recorded in the PR description, not a claim of improvement offered without one; "single-concern" means one call path or one identified bottleneck, not a repo-wide sweep that happens to touch performance-sensitive code along the way.

As with any other evidence requirement in this repo, the measurement belongs in the PR description itself — a number mentioned only in a commit message or a chat thread does not satisfy this rule.
