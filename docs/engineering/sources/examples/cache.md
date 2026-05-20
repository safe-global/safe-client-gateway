<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Cache Examples

Concrete `Avoid` / `Prefer` shapes lifted from CGW PR review feedback. See
`../rules.json` for the durable rules.

## CACHE-02 — Cache key includes every input that toggles behavior

Source: PR #2803 (RL-20251215-001)

### Avoid

Building the in-flight request cache key from `(url, options, timeout)`
while the wrapped call also takes a behavior toggle:

```ts
const get = async (url, options, timeout, useCircuitBreaker) => {
  const key = getCacheKey(url, options, timeout); // toggle missing
  if (cache[key]) return cache[key];
  cache[key] = request(url, options, timeout, useCircuitBreaker);
  return cache[key];
};
```

A request issued with `useCircuitBreaker: false` populates the cache; the
next call with `useCircuitBreaker: true` returns the same promise and
silently bypasses the breaker.

### Prefer

Pass every input that changes the wrapped behavior into the key:

```ts
const get = async (url, options, timeout, useCircuitBreaker) => {
  const key = getCacheKey(url, options, timeout, useCircuitBreaker);
  if (cache[key]) return cache[key];
  cache[key] = request(url, options, timeout, useCircuitBreaker);
  return cache[key];
};
```

### Why

In-flight caches dedupe identical work; "identical" must include every
input that toggles a side effect, or the cache turns into a covert
override of the toggle. The same applies to filters (`trusted`,
`excludeSpam`), sync/async modes, or any flag that picks a different
code path inside `request()`.

## CACHE-02 — Bump the key when the cached payload shape changes

Source: PR #2869 (RL-20260121-001)

### Avoid

Changing the value's shape but keeping the same cache key:

```ts
// before — cached value: { 'ethereum': '1', ... }
const cacheKey = 'zerion_chains:mapping';
const networkToChainId = JSON.parse(await cache.get(cacheKey));

// after — same key, new shape
const cacheKey = 'zerion_chains:mapping';
const { chainIdToName, nameToChainId } = JSON.parse(await cache.get(cacheKey));
// boom: post-deploy reads the OLD payload, chainIdToName is undefined
```

### Prefer

Either bump the key, version the payload, or invalidate on deploy — and
write the migration plan into the PR description so it does not get lost:

```ts
// option 1: bump the key suffix
const cacheKey = 'zerion_chains:mapping:v2';

// option 2: version the payload, fall back when the version is missing
const raw = JSON.parse(await cache.get(cacheKey));
if (raw?.version !== 2) await cache.invalidate(cacheKey);

// option 3: explicit cache invalidation in the deploy/migration step
await cache.invalidate('zerion_chains:mapping');
```

### Why

The old payload lives in Redis for hours after the deploy. Without a key
bump or version field, the new code reads the old shape, accesses
`undefined.something`, and takes balances/positions/portfolio offline for
the cache TTL of every affected user.

## CACHE-02 — Cache router owns the field, services should not override

Source: PR #2863 (RL-20260114-001)

### Avoid

A service overriding the `field` returned by the `CacheRouter` cache
directory:

```ts
// in CacheRouter.getEntityChainsCacheDir
return { key, field: isTestnet ? 'mapping_testnet' : 'mapping' };

// in the service — silently overrides the router's field
const field = isReverse
  ? (isTestnet ? 'mapping_reverse_testnet' : 'mapping_reverse')
  : (isTestnet ? 'mapping_testnet' : 'mapping');
const cached = await this.cacheService.hGet({ ...cacheDir, field });
```

### Prefer

Pass the field-distinguishing arg into the router and let the router own
every field name in the directory:

```ts
// CacheRouter
return {
  key,
  field: this.fieldFor({ isTestnet, isReverse }),
};

// service
const cacheDir = router.getEntityChainsCacheDir({ isTestnet, isReverse });
const cached = await this.cacheService.hGet(cacheDir);
```

### Why

When a service post-mutates the field, the router signature lies — readers
trust `getEntityChainsCacheDir(isTestnet)` to be authoritative, miss the
override branch in the service, and write to the wrong hash field. Routing
all field selection through the router keeps "what lives at this key" in
one place.

## CACHE-03 — Document expiry-only caches at the call site

Source: PR #2882 (RL-20260128-001)

### Avoid

Caching upstream data with no invalidation hook and no comment explaining
that the only freshness lever is TTL:

```ts
async getEntityByOwnerV2(args: ...): Promise<...> {
  const cacheDir = this.cacheRouter.getEntityByOwnerV2CacheDir(args);
  return this.dataSource.getFromCache({ cacheDir, url, expireTimeSeconds });
}
```

### Prefer

State the cache contract inline so the next reader knows there is no
invalidation path and that staleness is bounded by the TTL only:

```ts
async getEntityByOwnerV2(args: ...): Promise<...> {
  // No upstream hook invalidates this endpoint, so the cache lives until
  // entitiesExpirationTimeSeconds expires. Match the pattern on getEntityByOwner.
  const cacheDir = this.cacheRouter.getEntityByOwnerV2CacheDir(args);
  return this.dataSource.getFromCache({ cacheDir, url, expireTimeSeconds });
}
```

### Why

Expiry-only caches look identical to invalidation-backed ones at the call
site. Without the comment, the next change touching upstream behavior tends
to assume "the cache will be flushed on the next event," ships, and the
incident report is "stale data for up to N seconds." The comment makes the
contract explicit.

## CACHE-03 — Normalize cached payloads exactly once

Source: PR #2864 (RL-20260123-001)

### Avoid

Normalizing in both the writer and the reader paths so the cache hit
applies the transform a second time:

```ts
// writer — fetched from API, normalized, cached
const raw = await fetch(...);
const normalized = normalize(raw);     // negates loan values
await cache.set(key, JSON.stringify(normalized));
return map(normalized);

// reader — also normalizes
const cached = JSON.parse(await cache.get(key));
const normalized = normalize(cached);  // double-negates on cache hit
return map(normalized);
```

### Prefer

Pick one side. Cache the normalized shape and trust it on read, or cache
the raw shape and normalize on every read:

```ts
// option A: cache the normalized shape, do not re-normalize
const cached = JSON.parse(await cache.get(key));
return map(cached);

// option B: cache the raw shape, normalize at every read
const raw = JSON.parse(await cache.get(key));
return map(normalize(raw));
```

### Why

Two transforms in the same pipeline are an order-dependent footgun. On a
cache miss the cached value is normalized once; on a cache hit it is
normalized twice. Loan balances flip sign, totals diverge from the items,
and the bug only reproduces under cache-warm conditions.
