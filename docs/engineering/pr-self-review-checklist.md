<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# PR Self-Review Checklist

Run this before opening or finishing a PR. Each item references the convention
rule it is meant to enforce.

## How To Use

Always run the Scope section. Then run every section whose trigger matches the
change. If a section does not apply, skip it deliberately instead of answering
every item mechanically.

For every new file, provider, interface, helper, factory, injection token, or
module export, write a short new-abstractions note before opening the PR:

```text
New abstractions:
- <path/name>: <why direct local code was insufficient>
```

## Scope

Trigger: every PR.

- [ ] [CHANGE-01] Is this the smallest correct change for the behavior?
- [ ] [CHANGE-02] Did I avoid unrelated docs/config/formatting/generated
      changes?
- [ ] [CHANGE-03] If this is tooling work, did I preserve behavior, rule
      parity, and docs?
- [ ] [CHANGE-04] If this changes an external contract, is it versioned or
      explicitly backward-compatible?
- [ ] [PR-01] Can I justify every new abstraction or file?
- [ ] [PR-02] Are docs, samples, and runbooks aligned with the final behavior?

## Module And Layering

Trigger: modules, controllers, route services, repositories, datasources,
interfaces, providers, DI wiring, or new files.

- [ ] [MOD-01] Does new API/product behavior live in the right module?
- [ ] [MOD-02] Are persistence workflows hidden behind repositories?
- [ ] [MOD-03] Did I avoid single-use DI abstractions?
- [ ] [MOD-04] Did I avoid exposing private helper behavior through public
      interfaces?
- [ ] [MOD-05] Did I avoid adding or expanding `forwardRef` cycles?
- [ ] [MOD-06] Do route services stay behind repository boundaries?

## Naming, Reuse, And Style

Trigger: new public methods, helpers, constants, errors, DTOs, assertions,
logs, or non-trivial logic.

- [ ] [NAME-01] Do names describe behavior honestly and avoid redundant scope?
- [ ] [REUSE-01] Did I reuse existing helpers, constants homes, and utilities?
- [ ] [STYLE-01] Did I document public/non-trivial logic and remove dead code?

## Types And Schemas

Trigger: DTOs, schemas, external responses, token claims, queued jobs, casts,
or generated/API types.

- [ ] [TYPE-01] Did I use project types and shared schemas first?
- [ ] [TYPE-02] Are reusable schemas in entity/schema files?
- [ ] [TYPE-03] Are external responses, token claims, queued jobs, and config
      strings validated before use?
- [ ] [TYPE-04] Do DTO fields match the actual wire shape?
- [ ] [TYPE-05] Do parser/decode types include every field the code reads?
- [ ] [TYPE-06] Did I avoid unsafe casts, `any`, and silent type drift?

## Auth, Data, And Routes

Trigger: auth payloads, users, members, spaces, emails, route inputs, guards,
controllers, or API response shapes.

- [ ] [AUTH-01] Did I reuse existing auth assertions/predicates?
- [ ] [AUTH-02] Does identity code handle wallet and email users?
- [ ] [AUTH-03] Did I use proven auth/crypto libraries instead of custom
      primitives?
- [ ] [AUTH-04] Is user email exposure intentional and consistent?
- [ ] [ROUTE-01] Are controllers only HTTP boundary code?
- [ ] [ROUTE-02] Are params, query, and bodies validated?
- [ ] [ROUTE-03] Do empty responses use stable empty shapes?

## Database, Config, And Dependencies

Trigger: DB entities, migrations, indexes, transactions, Redis/cache writes,
env/config, dependency changes, Docker/CI/tooling versions, or `.env.sample`.

- [ ] [DB-01] Do unique constraints match nullable/lifecycle behavior?
- [ ] [DB-02] Are multi-step state transitions atomic?
- [ ] [DB-03] Did I avoid redundant reads/writes and no-op DB trips?
- [ ] [DB-04] Are DB errors mapped at the write boundary?
- [ ] [DB-05] Do migrations, entities, indexes, schemas, and tests agree?
- [ ] [CACHE-01] Are multi-step cache/Redis operations fully checked?
- [ ] [CACHE-02] Are cache keys, bounded caches, and TTL semantics tested?
- [ ] [CONFIG-01] Are defaults safe, minimal, and OSS-generic?
- [ ] [CONFIG-02] Does config validation fail at startup?
- [ ] [CONFIG-03] Are TTLs/timeouts/tunables configured?
- [ ] [CONFIG-04] Are runtime dependencies pinned exactly?
- [ ] [CONFIG-05] Do tool versions and env metadata match runtime behavior?

## Performance And Batching

Trigger: list mapping, DTO mapping, loops, cache fills, repository lookups,
external API calls, or hot paths.

- [ ] [PERF-01] Did I batch repeated DB/API work, cap user limits, and keep
      independent I/O parallel?

## Tests And Logs

Trigger: tests, fixtures, fakes, mocks, logging, telemetry, cache behavior,
security paths, config branches, or routing/precedence changes.

- [ ] [TEST-01] Did I use builders, fakes, and existing test helpers?
- [ ] [TEST-02] Is each assertion tested at the right layer?
- [ ] [TEST-03] Did I avoid mocking internal query-builder chains?
- [ ] [TEST-04] Are security and negative paths covered?
- [ ] [TEST-05] Is test cleanup scoped and minimal?
- [ ] [TEST-06] Do fixtures fail loudly instead of silently skipping?
- [ ] [TEST-07] Are routing/precedence pipelines covered end to end?
- [ ] [TEST-08] Do test names and generated data match the assertions?
- [ ] [TEST-09] Do tests cover edge cases, side effects, and deterministic
      behavior?
- [ ] [LOG-01] Are log levels operationally appropriate?
- [ ] [LOG-02] Did I avoid noisy success logs?
- [ ] [LOG-03] Is any new telemetry worth its operational cost?
- [ ] [LOG-04] Did I use structured log types and error normalization helpers?

## Security-Sensitive Inputs

Trigger: redirects, callbacks, tokens, API keys, secrets, encrypted values,
raw upstream payloads, or sensitive response fields.

- [ ] [SEC-01] Are redirect and callback targets strictly validated?
- [ ] [SEC-02] Are secrets, unverified payloads, and sensitive fields bounded
      and explicitly selected?
