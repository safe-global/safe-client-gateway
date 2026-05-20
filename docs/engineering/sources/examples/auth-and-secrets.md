<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Auth & Secrets Examples

Concrete `Avoid` / `Prefer` shapes lifted from CGW PR review feedback. See
`../rules.json` for the durable rules.

## SEC-02 — Default headers come first, caller headers override

Source: PR #2829 (RL-20251219-001)

### Avoid

Spreading the caller's headers first, then setting `Authorization` last
so the caller can never override the default:

```ts
function withAuth(args: TArgs): TArgs {
  return {
    ...args,
    networkRequest: {
      ...args.networkRequest,
      headers: {
        ...(args.networkRequest?.headers ?? {}),
        Authorization: `Bearer ${this.apiKey}`, // wins, always
      },
    },
  };
}
```

### Prefer

Put the default first; the caller's headers spread on top so a per-request
`Authorization` (or content-type, etc.) wins when explicitly passed:

```ts
function withAuth(args: TArgs): TArgs {
  return {
    ...args,
    networkRequest: {
      ...args.networkRequest,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(args.networkRequest?.headers ?? {}),
      },
    },
  };
}
```

### Why

The decorator's job is to add a default, not to mandate it. Callers
that genuinely need to send a different `Authorization` (a debugging
session, a follow-up call carrying a delegated token) cannot. Reversing
the spread order keeps the default in place for every normal call while
leaving an explicit override path open.

## SEC-02 / LOG-04 — Sensitive request material never appears raw in logs or cache keys

Source: PR #2829 (RL-20251219-001)

### Avoid

Building a cache key by stringifying the entire request, then logging
that stringified value as-is for diagnostics:

```ts
const key = JSON.stringify({ url, ...requestInit });
this.loggingService.info({ msg: 'cache lookup', key });
// `key` contains the Authorization header in plaintext
```

### Prefer

Hash the stringified key before storing or logging, and assert that no
log path emits the raw `requestInit` (including headers and body):

```ts
const rawKey = JSON.stringify({ url, ...requestInit });
const key = hashSha1(rawKey); // cache key, also what we log
this.loggingService.info({ msg: 'cache lookup', key });
```

When that path also has to log a URL or method for diagnostics, log only
those fields explicitly — never the whole `requestInit`.

### Why

`Authorization` is the obvious risk, but a stringified `requestInit`
also carries cookies, session tokens, and bodies. Hashing turns the
material into an opaque identifier suitable for both lookup and
diagnostics. A test that asserts `loggingService.info` is called with
fields that do not include `Authorization` keeps the contract pinned.
