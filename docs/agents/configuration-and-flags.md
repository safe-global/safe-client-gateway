<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Configuration and Flags

This guide sets the rules for adding, reading, and retiring configuration in CGW — where a new environment variable or feature flag is declared, how it is read once it lands, and why chain-specific behavior belongs in config rather than in a branch. Secret-handling specifics — no fallback defaults, deployed-environment `superRefine` checks, KMS-only signing — are `docs/agents/security.md`'s "Every env var through the schema" rule; this guide states the surrounding conventions that rule assumes.

### One config registry

**Rule:** A new environment variable is mapped into `src/config/entities/configuration.ts` and declared in `RootConfigurationSchema` (`src/config/entities/schemas/configuration.schema.ts`); outside `src/config/`, code does not read `process.env` directly.

**Why:** a value read ad hoc at its call site is invisible to anyone auditing what CGW's environment surface actually is; routing every read through one map keeps that surface discoverable with a single grep instead of a search scattered across services and datasources.

**Canonical example:** `configuration.ts` maps close to 280 variables this way, from `AMQP_URL` (`amqp.url`) to `CAPTCHA_SECRET_KEY` (`captcha.secretKey` — also `docs/agents/security.md`'s example for the schema half of this same pattern).

Two exceptions predate this guide and are not a template for new config. Three `@Cron(..., { disabled: process.env.NODE_ENV === 'test' })` sites gate a job off during test runs rather than read a configuration value — `src/modules/hooks/domain/helpers/event-cache.helper.ts`'s `logUnsupportedEvents`/`clearSupportedChainsMemo` and `src/domain/common/entities/safe-signature.ts`'s `clearSignatureMemo` — already covered by `docs/agents/caching-and-performance.md`'s cron-clearing rule. And the alerts module keeps its own `registerAs` factories (`src/modules/alerts/datasources/configuration/alerts-api.configuration.ts`, `src/modules/alerts/routes/configuration/alerts.configuration.ts`), each validated by a local Zod schema instead of `RootConfigurationSchema`; new config extends the central registry rather than adding a third.

### Read pattern

**Rule:** Config is read via `IConfigurationService.getOrThrow` in the constructor and cached to a `private readonly` field; a hot path never repeats the lookup.

**Why:** `getOrThrow` walks the merged config tree and throws on a missing key — cheap once, at boot, but a call site that defers the read to request time pays that walk on every request and turns a startup-time misconfiguration into a request-time failure instead.

**Canonical example:** `src/datasources/jwt/jwt.service.ts` declares `private readonly issuer: string` and `private readonly secret: string`, then sets both in the constructor — `this.issuer = this.configurationService.getOrThrow<string>('jwt.issuer')`, `this.secret = this.configurationService.getOrThrow<string>('jwt.secret')` — and never re-reads either in `sign`/`verify`.

`IConfigurationService` also exposes a non-throwing `get`, reserved for a key that is legitimately optional at runtime rather than a misconfiguration if absent — `src/datasources/cache/cache.module.ts`'s `redisUser`/`redisPass` read this way, since not every deployment sets Redis credentials.

### Test mirror

**Rule:** A change to `configuration.ts`'s shape updates its faker mirror at `src/config/entities/__tests__/configuration.ts` in the same change.

**Why:** the mirror's default export is typed `ReturnType<typeof configuration>`, so a field added to, renamed in, or removed from the real config without a matching edit here fails to compile, rather than surfacing later as a runtime gap in some unrelated spec.

**Canonical example:** `src/config/entities/__tests__/configuration.ts` fakes every branch of the real shape with `@faker-js/faker` — e.g. `auth.token: faker.string.hexadecimal({ length: 32 })`, `auth.nonceTtlSeconds: faker.number.int()` — and is consumed by `src/__tests__/testing-module.ts` as the `configFactory` behind full app-bootstrap specs.

This mirror is distinct from the narrower `FakeConfigurationService` (`src/config/__tests__/fake.configuration.service.ts`, see `docs/agents/module-structure.md`'s Symbol+interface rule), which a unit spec populates one key at a time with `.set(key, value)` rather than importing a full faked tree.

### Env docs loop

**Rule:** A new variable is added to `.env.sample.json` (`name`, `description`, `defaultValue`, `required`) in the same change that introduces it, and `yarn env:validate` passes.

**Why:** `scripts/validate-env-json.ts` — the script behind `env:validate` — greps every non-spec file under `src/` for `process.env.<NAME>` and fails when a name it finds has no matching entry in `.env.sample.json`, so an undocumented var is a build-time failure, not a gap someone notices later.

**Canonical example:** `.husky/pre-commit` runs `yarn run env:validate:silent` before `lint`/`format`, and `.github/workflows/ci.yml` runs the same `env:validate:silent` step, so an undocumented var fails at commit time and again in CI if the hook was ever bypassed.

An entry that lingers in `.env.sample.json` after its variable leaves the code only warns (`extraInJson`) and exits zero; deleting the stale entry is good hygiene, not something either check enforces.

### Feature flags

**Rule:** A feature flag's environment variable carries the `FF_` prefix and is read via the `features.*` namespace; a new flag's mapping in `configuration.ts` carries a comment naming an owner and the condition under which the flag comes out.

**Why:** a flag that ships with no stated removal condition has historically outlived the rollout it gated, since adding it forces nothing that also schedules taking it back out.

**Canonical example:** `FF_DEBUG_LOGS`/`FF_CONFIG_HOOKS_DEBUG_LOGS` map to `features.debugLogs`/`features.configHooksDebugLogs`, both read via `getOrThrow<boolean>` into `private readonly` fields in `src/datasources/cache/cache.first.data.source.ts`'s constructor — the read-pattern rule above, namespaced under `features`.

The owner-plus-condition comment applies to flags added from this guide onward — no mapping in `configuration.ts` carries the full comment yet, so there is no live example to copy. The nearest existing precedent is the entry for `FF_TRUSTED_FOR_DELEGATE_CALL_CONTRACTS_LIST`, commented `// TODO: Remove this feature flag once the feature is established.` — a condition with no owner attached. A new flag's comment states both, and the first one to land becomes the canonical example.

### No chain special-casing in code

**Rule:** A service or datasource never branches on a hardcoded chain ID; where behavior must vary by chain, the variance is a config value keyed by chain, not an `if (chainId === '...')` in application code.

**Why:** a hardcoded chain-ID branch sits outside the config surface the rest of this guide builds — it can't be typed by the schema, documented by `.env.sample.json`, or grepped for the way a config value can, and nothing stops it from quietly multiplying as CGW adds chains.

**Canonical example:** the only instance of this in the codebase today is also the anti-example, not a precedent — `src/modules/transactions/datasources/transaction-api.service.ts` declares `private static readonly HOODI_CHAIN_ID = '560048'` and `BASE_CHAIN_ID = '8453'` as static class fields, and its constructor branches on them to pick `expirationTimeInSeconds.hoodi` over the default TTL keys:

```ts
// TODO: Remove temporary cache times for Hoodi chain.
if (
  chainId === TransactionApi.HOODI_CHAIN_ID ||
  // TODO: Remove after Vault decoding has been released
  (!isProduction && chainId === TransactionApi.BASE_CHAIN_ID)
) {
```

Both branches are marked for removal in their own comments, and neither is a template for new code — do not imitate the pattern.

The TTL values on both sides of that branch are themselves correctly config-sourced, which is the pattern `docs/agents/caching-and-performance.md`'s TTL rule documents from this same constructor; this rule targets only the chain-ID check gating them.

### Secrets

**Rule:** A secret's mapping in `configuration.ts` carries no `||`/`??` fallback default; a requirement that holds only in a deployed environment is enforced in `RootConfigurationSchema`'s `superRefine`, never assumed at the call site; a private signing key has no path into a deployed environment's running config, since signing there goes through KMS only.

**Why:** see `docs/agents/security.md`'s "Every env var through the schema" rule — the incident history and reasoning behind each half of this convention live there, not here.

**Canonical example:** that rule's `CAPTCHA_SECRET_KEY`/`BILLING_WEBHOOK_JWT_PRIVATE_KEY` pair and its `superRefine` block are the canonical instance; this guide states the convention rather than repeating it.
