<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Error & Absence Handling Examples

Concrete `Avoid` / `Prefer` shapes lifted from CGW PR review feedback. See
`../rules.json` for the durable rules.

## STYLE-01 / LOG-04 — Internal errors do not leak into user responses

Source: PR #2856 (RL-20251222-001)

### Avoid

Forwarding the raw caught error into the user-facing response field, and
shipping the temporary `console.log` left over from local debugging:

```ts
const request_id = response.headers.get(REQUEST_ID_HEADER) ?? undefined;

// TODO: remove logging after adding Blockaid error mapping:
console.log('!!!! data:', data);

try {
  // ...
} catch (error) {
  return this.failedAnalysisResponse(
    error instanceof Error ? error.message : String(error),
  );
}
```

### Prefer

Map known internal failures to a generic user-facing response and log
the raw cause through the structured logger; leave `console.log` out of
merged code:

```ts
const request_id = response.headers.get(REQUEST_ID_HEADER) ?? undefined;

try {
  // ...
} catch (error) {
  this.loggingService.error({ type: LogType.AnalysisFailure, cause: asError(error) });
  return this.failedAnalysisResponse();
}
```

### Why

A raw HTTP error or stack trace surfacing in an analysis response gives
the consumer information they cannot act on, and routinely leaks internal
hostnames or upstream error codes. Catch-and-log keeps the diagnostic
information in a place we can mine; the response stays at the boundary's
contract.

## TYPE-02 / TYPE-03 — Empty external error strings normalize to absence

Source: PR #2866 (RL-20260116-002)

### Avoid

Returning the empty string as if it were a useful error, or testing for
absence with overly specific equality:

```ts
export const prepareErrorMessage = (error?: string): string | undefined => {
  if (error === undefined || error === '') return undefined;
  const match = error.match(/GS\d{3}/);
  if (!match) return error;
  const mapped = ERROR_MAPPING[match[0]];
  return mapped ?? error; // can be '' if a mapping is empty
};
```

### Prefer

Coalesce empty and undefined at the entry, drop the redundant check, and
keep the return type honest (`string | undefined`):

```ts
export const prepareErrorMessage = (error?: string): string | undefined => {
  if (!error) return undefined;
  const match = error.match(/GS\d{3}/);
  if (!match) return error;
  return ERROR_MAPPING[match[0]] ?? error;
};
```

### Why

When an external error carries no user-facing information (`''`), the
caller wants to render "no message," not an empty string. Pushing the
normalization into the helper keeps the contract simple — every caller
either gets a non-empty string or `undefined`, never both shapes for the
same notion of absence.

## LOG-01 / ROUTE-03 — Unknown mappings return absence, not a plausible default

Source: PR #2863 (RL-20260114-002)

### Avoid

Falling back to a plausible-looking default when an external mapping is
missing:

```ts
async getChainIdFromNetwork(networkName: string): Promise<string> {
  const chainId = mappings.nameToChainId[networkName];
  if (!chainId) {
    this.loggingService.warn(
      `Unknown network: "${networkName}", defaulting to Ethereum mainnet (chain ID 1)`,
    );
    return '1';
  }
  return chainId;
}
```

### Prefer

Return `undefined` (or throw, depending on the call site) and let the
caller fall back to the non-provider path or skip the item explicitly:

```ts
async getChainIdFromNetwork(networkName: string): Promise<string | undefined> {
  const chainId = mappings.nameToChainId[networkName];
  if (!chainId) {
    this.loggingService.warn(`Unknown network: "${networkName}"`);
    return undefined;
  }
  return chainId;
}
```

### Why

A "default to mainnet" branch silently ascribes balances and positions to
the wrong chain — the response looks valid, the metric is clean, and the
bug only shows up when a user notices their multi-chain wallet has the
wrong totals. Returning absence forces every caller to handle the
unknown case at the boundary they own.
