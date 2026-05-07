<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Resilience Examples

Concrete `Avoid` / `Prefer` shapes lifted from CGW PR review feedback. See
`../rules.json` for the durable rules.

## RESILIENCE-01 — Classify failures and scope the policy key

Source: PR #2803 (RL-20251215-002)

### Avoid

Counting only HTTP 5xx as failures, and using the full URL as the breaker
key so each endpoint trips independently:

```ts
const circuit = circuitBreaker.getOrRegisterCircuit(url);
try {
  return await request(url, options, timeout);
} catch (error) {
  if (error instanceof NetworkResponseError && error.response.status >= 500) {
    circuitBreaker.recordFailure(circuit);
  }
  // network errors / timeouts never trip the breaker
  // separate breaker for /api/v1/owners vs /api/v1/safes — same upstream
  throw error;
}
```

### Prefer

Key by service hostname; classify network errors and timeouts as
failures alongside 5xx so the breaker reflects upstream health:

```ts
const circuitName = new URL(url).hostname;
try {
  return await request(url, options, timeout);
} catch (error) {
  const isFailure =
    (error instanceof NetworkResponseError && error.response.status >= 500) ||
    error instanceof NetworkRequestError; // timeouts, DNS, connection refused
  if (isFailure) {
    const circuit = circuitBreaker.getOrRegisterCircuit(circuitName);
    circuitBreaker.recordFailure(circuit);
  }
  throw error;
}
```

### Why

A breaker keyed per URL only opens when one endpoint of a service fails
repeatedly, while the rest of the service's endpoints keep dogpiling
the same down upstream. Counting only 5xx misses the worst real-world
failure mode — the upstream that times out or refuses connections — so
the breaker never opens against a fully unresponsive service.

## RESILIENCE-01 — Do not count policy-blocked attempts as policy failures

Source: PR #2803 (RL-20251215-002)

### Avoid

Recording every exception in the wrapped path, including the breaker's
own "blocked" exception, as a downstream failure:

```ts
try {
  circuitBreaker.canProceedOrFail(circuitName);
  return await request(url, options, timeout);
} catch (error) {
  if (
    (error instanceof NetworkResponseError && error.response.status >= 500) ||
    error instanceof NetworkRequestError ||
    error instanceof CircuitBreakerException // blocked, not a failure
  ) {
    circuitBreaker.recordFailure(circuitName);
  }
  throw error;
}
```

### Prefer

Treat the breaker's own block as the breaker's mechanism, not as new
evidence of upstream failure:

```ts
try {
  circuitBreaker.canProceedOrFail(circuitName);
  return await request(url, options, timeout);
} catch (error) {
  const isDownstreamFailure =
    (error instanceof NetworkResponseError && error.response.status >= 500) ||
    error instanceof NetworkRequestError;
  if (isDownstreamFailure) {
    circuitBreaker.recordFailure(circuitName);
  }
  throw error;
}
```

### Why

Counting blocked attempts as failures keeps `lastFailureTime` updating
forever, so stale-cleanup never runs and the breaker stays open across
the entire stale window even after the upstream has recovered. It also
inflates failure metrics with events that, by definition, never reached
the upstream.

## RESILIENCE-01 — Stale-cleanup multiplies durations, not timestamps

Source: PR #2803 (RL-20251215-002)

### Avoid

Multiplying an absolute timestamp (epoch milliseconds) by a buffer
factor when computing a stale-bound:

```ts
const staleNextAttemptTime =
  circuit.metrics.nextAttemptTime
    ? circuit.metrics.nextAttemptTime * STALE_BUFFER_FACTOR
    : Date.now();
// nextAttemptTime is e.g. 1734567890000 — multiplying by 2 lands in 2077
```

### Prefer

Multiply only the duration; add the result to the timestamp:

```ts
const bufferMs = circuit.config.timeoutMs * STALE_BUFFER_FACTOR;
const staleNextAttemptTime = circuit.metrics.nextAttemptTime
  ? circuit.metrics.nextAttemptTime + bufferMs
  : Date.now();
```

### Why

A timestamp times a constant is a date in the far future; the
`now < staleNextAttemptTime` check is then always true, so OPEN circuits
never get cleaned up and the in-memory map grows monotonically. The bug
is invisible in unit tests that mock `Date.now()` to a small value.

## RESILIENCE-01 — Error type stays consistent across the policy boundary

Source: PR #2803 (RL-20251215-002)

### Avoid

Pulling URL parsing (or any other wrapper-only step) outside the
boundary that wraps and rethrows raw errors as the framework's typed
error:

```ts
function withCircuitBreaker(url: string, options: RequestInit) {
  if (!useCircuitBreaker) {
    return request(url, options); // wraps URL errors as NetworkRequestError
  }

  const { hostname } = new URL(url); // raw TypeError on malformed URL
  // ...
}
```

### Prefer

Keep the wrapping boundary the same regardless of the flag — either
parse inside `request()` or wrap the parse in the same `try/catch`
that produces `NetworkRequestError`:

```ts
function withCircuitBreaker(url: string, options: RequestInit) {
  try {
    const circuitName = new URL(url).hostname;
    if (!useCircuitBreaker) return request(url, options);
    circuitBreaker.canProceedOrFail(circuitName);
    return await request(url, options);
  } catch (error) {
    throw asNetworkError(error);
  }
}
```

### Why

Callers'`catch` handlers branch on the framework's typed errors. A flag
that flips a raw `TypeError` through to the caller breaks every error
handler that assumed `NetworkRequestError | NetworkResponseError`, and
the breakage only shows up when a malformed URL slips in.
