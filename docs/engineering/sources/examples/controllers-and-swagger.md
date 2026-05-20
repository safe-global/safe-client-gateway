<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Controllers & Swagger Examples

Concrete `Avoid` / `Prefer` shapes lifted from CGW PR review feedback. See
`../rules.json` for the durable rules.

## ROUTE-01 — Do not name internal providers in user-facing Swagger copy

Source: PR #2840 (RL-20260108-003)

### Avoid

Leaking the internal provider name into the public API documentation:

```ts
@ApiOperation({
  summary: 'Get Safe overview (v2)',
  description:
    'Retrieves an overview of multiple Safes using Zerion portfolio data ' +
    'for enabled chains. Supports cross-chain queries.',
})
```

### Prefer

Describe the contract from the consumer's perspective; let the controller
choose the implementation behind the scenes:

```ts
@ApiOperation({
  summary: 'Get Safe overview (v2)',
  description:
    'Retrieves an overview of multiple Safes across the supported chains.',
})
```

### Why

Provider names are internal infrastructure choices that change without a
contract bump. Documenting them ties consumers to an implementation detail
they should not depend on, and makes it harder to swap the backing source
(or run two side by side) without a noisy public diff.

## ROUTE-01 — Do not claim a standard the implementation does not satisfy

Source: PR #2840 (RL-20260108-003)

### Avoid

Labelling a parameter as a well-known standard when the format actually
accepted differs:

```ts
@ApiQuery({
  name: 'safes',
  type: String,
  description: 'Comma-separated list of Safe addresses in CAIP-10 format ' +
               '(chainId:address)',
})
```

### Prefer

Describe the format the controller actually parses, in its own words:

```ts
@ApiQuery({
  name: 'safes',
  type: String,
  description: 'Comma-separated list of `chainId:address` pairs',
})
```

### Why

CAIP-10 has a specific shape (`namespace:reference:account_address`).
Accepting `chainId:address` and labelling it CAIP-10 invites consumers to
parse it as the standard, fail on the first edge case, and blame the
spec. Naming the format honestly keeps the contract testable.

## TYPE-04 / ROUTE-01 — Public params apply on every code path or are removed

Source: PR #2840 (RL-20260108-002)

### Avoid

Accepting `trusted` and `excludeSpam` on the endpoint but silently
ignoring them when one provider path is taken:

```ts
async getSafeOverview({ chain, trusted, excludeSpam }: Args) {
  if (this.providerEnabled(chain)) {
    // provider returns all positions; trusted/excludeSpam ignored
    return this.providerApi.getOverview({ chain });
  }
  return this.legacyApi.getOverview({ chain, trusted, excludeSpam });
}
```

### Prefer

Pick one of:

1. Apply equivalent filtering on the provider path so behaviour matches
   on every chain.
2. Remove the parameter from the public endpoint when it cannot be
   honoured uniformly.
3. If neither is feasible yet, narrow the parameter's scope explicitly
   in the Swagger description and the controller's `@ApiQuery` so
   consumers can see the limitation.

```ts
@ApiQuery({
  name: 'trusted',
  required: false,
  type: Boolean,
  description: 'Restrict to trusted tokens. Ignored on chains served by ' +
               'the portfolio provider.',
})
```

### Why

Filters that work on some chains and not others are an undebuggable
behaviour difference for the consumer — the same query produces different
shapes depending on which chain is queried, and the API documentation
gives no hint. Either honour the param everywhere or stop accepting it.
