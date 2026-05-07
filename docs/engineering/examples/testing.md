<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Testing Examples

Concrete `Avoid` / `Prefer` shapes lifted from CGW PR review feedback. Each
block traces back to the originating PR and `RL-*` so the source review can
be re-read without grepping. See `../rules.json` for the durable rules these
examples illustrate.

## TEST-01 — Use a builder for repeated entity fixtures

Source: PR #2884, #2883 (RL-20260506-002)

### Avoid

Copy-pasting object literals across tests when the same entity shape is
constructed more than once:

```ts
const entity = {
  fallbackHandler: getAddress(faker.finance.ethereumAddress()),
  guard: getAddress(faker.finance.ethereumAddress()),
  moduleGuard: getAddress(faker.finance.ethereumAddress()),
  enabledModules: [getAddress(faker.finance.ethereumAddress())],
};
```

### Prefer

A `Builder<T>` with `.with(field, value)` that lives next to the entity, so
each test only spells out the fields it cares about:

```ts
const entity = entityBuilder()
  .with('guard', specificGuard)
  .build();
```

### Why

Inline literals drift across tests as the entity shape evolves; a missing
field one place and an out-of-date constant in another silently weaken
assertions. The repo's `Builder<T>` pattern keeps a single source of truth
for each shape and lets a test override only what matters to that case.

## TEST-02 — Suffix matches the test layer

Source: PR #2886, #2884 (RL-20260506-001) — also relevant to NAME-01

### Avoid

Picking the suffix to match sibling files:

```text
src/modules/owners/routes/
├── owners.controller.v1.spec.ts             // unit
├── owners.controller.v2.spec.ts             // unit
└── owners.controller.v3.integration.spec.ts // boots Nest, hits DB
```

…or the inverse, naming a Nest-bootstrapped suite `*.spec.ts` because the
neighbours do.

### Prefer

Pick the suffix from what the test actually does:

- `*.spec.ts` — unit, no Nest bootstrap, no DB / Redis / queue.
- `*.integration.spec.ts` — boots Nest modules or hits a real DB.

If the existing siblings have the wrong suffix for the layer they exercise,
that is a separate cleanup, not a reason to keep extending the wrong name.

### Why

Two reviewers in the same week pulled in opposite directions on this PR —
one asked for `.spec.ts` for sibling consistency, the other asked for
`.integration.spec.ts` because the suite booted Nest. The team's answer is
that the suffix encodes the test layer, not the file's neighbours, so unit
runs can stay fast and integration runs stay reproducible.

## TEST-04 — When a required field is added to config, update every fixture

Source: PR #2873 (RL-20260506-004)

### Avoid

Adding a new required field to the validated configuration schema and
updating only the `validConfiguration` fixture:

```ts
// configuration.schema.ts
RootConfigurationSchema = z.object({
  // ...
  REQUIRED_NEW_FIELD: z.string(), // newly required
});

// __tests__/configuration.ts
export const validConfiguration = { ..., REQUIRED_NEW_FIELD: 'value' };
// invalidConfiguration variants left as-is — still missing REQUIRED_NEW_FIELD
```

### Prefer

Add the field to every fixture the schema is parsed against, including
`invalidConfiguration` variants that test unrelated invalid fields, plus the
`it.each` listing required keys:

```ts
const baseInvalid = { ..., REQUIRED_NEW_FIELD: 'value' };
export const invalidLogLevelConfig = { ...baseInvalid, LOG_LEVEL: 'wat' };
// it.each for required keys also lists REQUIRED_NEW_FIELD
```

### Why

If `invalidLogLevelConfig` is missing `REQUIRED_NEW_FIELD`, the parser fails
on the new field rather than the intended `LOG_LEVEL` problem, so the test
silently asserts the wrong thing and looks green for the wrong reason.

## TEST-05 — Restore `process.env` and trim secret-shaped strings

Source: PR #2829 (RL-20251219-002)

### Avoid

Mutating `process.env.NODE_ENV` per test without restoring, and validating
secret-shaped strings without trimming:

```ts
it('rejects empty API_KEY in production', () => {
  process.env.NODE_ENV = 'production';
  expect(() => validate({ API_KEY: '' })).toThrow();
});
// other tests now also see NODE_ENV=production
```

### Prefer

Snapshot `NODE_ENV` once at file scope and restore in `afterEach`; assert
that whitespace-only secrets are rejected because the validator trims:

```ts
let originalNodeEnv: string | undefined;
beforeAll(() => { originalNodeEnv = process.env.NODE_ENV; });
afterEach(() => { process.env.NODE_ENV = originalNodeEnv; });

it.each(['', '   '])('rejects blank API_KEY in production', (apiKey) => {
  process.env.NODE_ENV = 'production';
  expect(() => validate({ API_KEY: apiKey })).toThrow();
});
```

### Why

Leaking `NODE_ENV=production` into later tests is a classic order-dependent
failure — pass alone, fail in suite. The `'   '` row catches the easy
mistake of letting whitespace stand in for a configured secret.

## TEST-09 — Cover the negative paths around safety-critical extraction

Source: PR #2854 (RL-20251223-002)

### Avoid

Testing only the positive path of a security-relevant extractor:

```ts
it('returns UNOFFICIAL when handler is not official Safe or trusted', () => {
  // happy path only — extracts handler, classifies as unofficial
});
```

### Prefer

Add explicit negative-path tests for the inputs an attacker or buggy caller
can supply:

```ts
it('returns undefined when the parameter name does not match');
it('returns undefined when the address fails isAddress');
it('keeps the last value when setHandler is called multiple times');
it('returns undefined when tx.data exists but parameters are missing');
it('omits the warning when the handler is an official Safe handler');
```

### Why

The bug class here is "we extract or classify, but the inputs we did not
test slip through and reach a downstream branch that assumes shape." Each
negative-path test pins one of those slipping inputs, including the
official-handler false-positive path that exists specifically to suppress
noise.
