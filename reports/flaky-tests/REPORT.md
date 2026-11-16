# Flaky Test Baseline Report

Generated: 2026-11-16T18:58:26.529Z | Period: 2026-01-16 to 2026-11-16

## Summary

| Metric | Value |
|--------|-------|
| **Confidence flake rate <0.5%** (last 4 weeks) | **8%** (3 flaky / 323 commits) |
| Total unique commits | 3577 |
| Flaky commits (pass + fail on same SHA) | 148 |
| Flakiness rate | 4.1% |

Since 2026-06-04 a commit also counts as flaky when a failed attempt was recovered by re-running the same workflow run (GitHub reports only the final attempt, so this signal needs a per-attempt lookup). Earlier weeks lack that signal and understate flakiness.

Confidence is the probability that the per-commit flake rate is <0.5%, given the flaky and total commits of the last 4 weeks (binomial model, uniform prior). Flakes nobody re-ran are not seen, so the true confidence is somewhat lower.

## Weekly Trend

![Weekly flake rate and confidence](trend.svg)

<details>
<summary>Weekly numbers</summary>

| Week | Commits | Flaky | Rate | Confidence <0.5% (4 wk) |
|------|---------|-------|------|------|
| 2026-01-12 | 7 | 1 | 14.3% | 0% |
| 2026-01-19 | 37 | 7 | 18.9% | 0% |
| 2026-01-26 | 65 | 10 | 15.4% | 0% |
| 2026-02-02 | 74 | 4 | 5.4% | 0% |
| 2026-02-09 | 72 | 5 | 6.9% | 0% |
| 2026-02-16 | 80 | 4 | 5% | 0% |
| 2026-02-23 | 57 | 1 | 1.8% | 0% |
| 2026-03-02 | 71 | 5 | 7% | 0% |
| 2026-03-09 | 47 | 1 | 2.1% | 0% |
| 2026-03-16 | 31 | 3 | 9.7% | 0% |
| 2026-03-23 | 59 | 3 | 5.1% | 0% |
| 2026-03-30 | 38 | 2 | 5.3% | 0% |
| 2026-04-06 | 116 | 11 | 9.5% | 0% |
| 2026-04-13 | 11 | 0 | 0% | 0% |
| 2026-04-20 | 19 | 1 | 5.3% | 0% |
| 2026-04-27 | 109 | 9 | 8.3% | 0% |
| 2026-05-04 | 138 | 8 | 5.8% | 0% |
| 2026-05-11 | 40 | 1 | 2.5% | 0% |
| 2026-05-18 | 80 | 9 | 11.3% | 0% |
| 2026-05-25 | 60 | 4 | 6.7% | 0% |
| 2026-06-01 | 106 | 6 | 5.7% | 0% |
| 2026-06-08 | 83 | 9 | 10.8% | 0% |
| 2026-06-15 | 66 | 12 | 18.2% | 0% |
| 2026-06-22 | 78 | 4 | 5.1% | 0% |
| 2026-06-29 | 84 | 3 | 3.6% | 0% |
| 2026-07-06 | 101 | 2 | 2% | 0% |
| 2026-07-13 | 102 | 1 | 1% | 0% |
| 2026-07-20 | 74 | 2 | 2.7% | 0% |
| 2026-07-27 | 50 | 1 | 2% | 0% |
| 2026-08-03 | 54 | 0 | 0% | 1% |
| 2026-08-10 | 46 | 0 | 0% | 3% |
| 2026-08-17 | 108 | 6 | 5.6% | 0% |
| 2026-08-24 | 75 | 0 | 0% | 0% |
| 2026-08-31 | 12 | 0 | 0% | 0% |
| 2026-09-07 | 48 | 3 | 6.3% | 0% |
| 2026-09-14 | 143 | 3 | 2.1% | 0% |
| 2026-09-21 | 182 | 3 | 1.6% | 0% |
| 2026-09-28 | 109 | 0 | 0% | 0% |
| 2026-10-05 | 152 | 1 | 0.7% | 1% |
| 2026-10-12 | 165 | 0 | 0% | 19% |
| 2026-10-19 | 205 | 0 | 0% | 82% |
| 2026-10-26 | 110 | 1 | 0.9% | 61% |
| 2026-11-02 | 33 | 0 | 0% | 73% |
| 2026-11-09 | 136 | 2 | 1.5% | 23% |
| 2026-11-16 | 44 | 0 | 0% | 8% |

</details>

## Clean Streak

44 commits without a flake since the last flaky week — rate is below 6.8% at 95% confidence. Target <0.5% at 95% needs a **600-commit** streak (556 to go).

## Flaky Test Leaderboard

| File | Failures | Last failure | Status | Fix PR | Fix confidence |
|------|----------|--------------|--------|--------|----------------|
| `src/modules/transactions/routes/__tests__/controllers/preview-transaction-kiln.transactions.controller.integration.spec.ts` | 27 | 2026-07-01 | Fixed | [#3242](https://github.com/safe-global/safe-client-gateway/pull/3242) | 100% |
| `src/modules/transactions/routes/__tests__/controllers/preview-transaction-cow-swap.transactions.controller.integration.spec.ts` | 17 | 2026-06-19 | Fixed | [#3242](https://github.com/safe-global/safe-client-gateway/pull/3242) | 100% |
| `src/routes/common/guards/rate-limit.guard.spec.ts` | 14 | 2026-06-30 | Fixed | [#3139](https://github.com/safe-global/safe-client-gateway/pull/3139) | 100% |
| `src/modules/targeted-messaging/datasources/targeted-messaging.datasource.integration.spec.ts` | 12 | 2026-02-01 | Fixed | [#2891](https://github.com/safe-global/safe-client-gateway/pull/2891) | 100% |
| `src/modules/transactions/routes/__tests__/controllers/propose-transaction.transactions.controller.integration.spec.ts` | 12 | 2026-06-26 | Fixed | [#3242](https://github.com/safe-global/safe-client-gateway/pull/3242) | 100% |
| `src/datasources/cache/redis.cache.service.integration.spec.ts` | 11 | 2026-06-18 | Fixed | [#3136](https://github.com/safe-global/safe-client-gateway/pull/3136) | 100% |
| `src/datasources/job-queue/__tests__/job-queue.service.integration.spec.ts` | 11 | 2026-10-29 | Fixed | [#3751](https://github.com/safe-global/safe-client-gateway/pull/3751) | 13% |
| `src/modules/notifications/routes/v2/notifications.controller.integration.spec.ts` | 10 | 2026-09-11 | Fixed | [#3572](https://github.com/safe-global/safe-client-gateway/pull/3572) | 84% |
| `src/modules/safe-shield/recipient-analysis/recipient-analysis.service.spec.ts` | 10 | 2026-08-19 | Fixed | [#3572](https://github.com/safe-global/safe-client-gateway/pull/3572) | 84% |
| `src/modules/transactions/routes/helpers/transaction-verifier.helper.spec.ts` | 10 | 2026-10-09 | Fixed | [#3572](https://github.com/safe-global/safe-client-gateway/pull/3572) | 84% |
| `src/modules/transactions/routes/mappers/common/transaction-data.mapper.spec.ts` | 9 | 2026-06-15 | Fixed | [#3139](https://github.com/safe-global/safe-client-gateway/pull/3139) | 100% |
| `src/modules/users/domain/users.repository.integration.spec.ts` | 9 | 2026-09-24 | Fixed | [#3506](https://github.com/safe-global/safe-client-gateway/pull/3506) | 95% |
| `src/modules/transactions/routes/__tests__/controllers/add-transaction-confirmations.transactions.controller.integration.spec.ts` | 7 | 2026-06-19 | Fixed | [#3242](https://github.com/safe-global/safe-client-gateway/pull/3242) | 100% |
| `src/domain/common/entities/safe-signature.spec.ts` | 6 | 2026-08-17 | Fixed | [#3572](https://github.com/safe-global/safe-client-gateway/pull/3572) | 67% |
| `src/modules/users/domain/members.repository.integration.spec.ts` | 5 | 2026-02-01 | Fixed | [#2891](https://github.com/safe-global/safe-client-gateway/pull/2891) | 100% |
| `src/modules/messages/domain/helpers/message-verifier.helper.spec.ts` | 5 | 2026-09-14 | Fixed | [#3572](https://github.com/safe-global/safe-client-gateway/pull/3572) | 60% |
| `src/modules/auth/utils/auth-redirect.helper.spec.ts` | 3 | 2026-06-11 | Fixed | [#3162](https://github.com/safe-global/safe-client-gateway/pull/3162) | 99% |
| `src/modules/bridge/domain/entities/bridge-name.entity.spec.ts` | 3 | 2026-07-09 | Fixed | [#3242](https://github.com/safe-global/safe-client-gateway/pull/3242) | 97% |
| `src/modules/transactions/routes/helpers/space-queue.helper.spec.ts` | 3 | 2026-11-13 | Fixed | [#3761](https://github.com/safe-global/safe-client-gateway/pull/3761) | 4% |
| `src/modules/transactions/routes/__tests__/controllers/get-transaction-by-id.transactions.controller.integration.spec.ts` | 2 | 2026-04-10 | Fixed | [#3242](https://github.com/safe-global/safe-client-gateway/pull/3242) | 90% |
| `src/modules/users/domain/__tests__/user-identity-resolver.service.spec.ts` | 2 | 2026-05-19 | Removed from main | - | - |
| `src/modules/surveys/routes/surveys.controller.integration.spec.ts` | 2 | 2026-08-21 | Fixed | [#3594](https://github.com/safe-global/safe-client-gateway/pull/3594) | 3% |
| `src/modules/transactions/routes/__tests__/controllers/preview-transaction.transactions.controller.integration.spec.ts` | 2 | 2026-09-21 | Fixed | [#3594](https://github.com/safe-global/safe-client-gateway/pull/3594) | 3% |
| `src/modules/transactions/routes/__tests__/controllers/preview-transaction-cow-swap.transactions.controller.spec.ts` | 1 | 2026-01-29 | Removed from main | - | - |
| `src/modules/transactions/routes/__tests__/controllers/preview-transaction-kiln.transactions.controller.spec.ts` | 1 | 2026-01-19 | Removed from main | - | - |
| `src/modules/safe-shield/safe-shield.controller.integration.spec.ts` | 1 | 2026-02-11 | Fixed | [#3242](https://github.com/safe-global/safe-client-gateway/pull/3242) | 68% |
| `src/modules/safe-apps/routes/safe-apps.controller.integration.spec.ts` | 1 | 2026-02-11 | Fixed | [#3242](https://github.com/safe-global/safe-client-gateway/pull/3242) | 68% |
| `src/modules/auth/routes/auth.controller.integration.spec.ts` | 1 | 2026-04-15 | Fixed | [#3136](https://github.com/safe-global/safe-client-gateway/pull/3136) | 75% |
| `src/domain/common/entities/name.builder.spec.ts` | 1 | 2026-07-03 | Fixed | [#3242](https://github.com/safe-global/safe-client-gateway/pull/3242) | 68% |
| `src/modules/notifications/routes/v1/notifications.controller.integration.spec.ts` | 1 | 2026-09-21 | Fixed | [#3617](https://github.com/safe-global/safe-client-gateway/pull/3617) | 1% |

## Fix PRs

- [#3560](https://github.com/safe-global/safe-client-gateway/pull/3560) - build: migrate runtime, tooling and tests from node to bun (Closed)
- [#3762](https://github.com/safe-global/safe-client-gateway/pull/3762) - test(spaces): give invited members valid names in the address book tags spec (Merged)
- [#3751](https://github.com/safe-global/safe-client-gateway/pull/3751) - fix(tests): wait for job completion before asserting worker events (Merged)
- [#3761](https://github.com/safe-global/safe-client-gateway/pull/3761) - test: fix two tests that fail at random (chain order, short member names) (Merged)
- [#3594](https://github.com/safe-global/safe-client-gateway/pull/3594) - fix: make the v2 migrator lock acquisition atomic (Merged)
- [#3617](https://github.com/safe-global/safe-client-gateway/pull/3617) - fix(tests): expect one upsert per registration with safes in v1 notifications spec (Merged)
- [#3692](https://github.com/safe-global/safe-client-gateway/pull/3692) - test(policies): fuzz the delayed guard policies mapper (Closed)
- [#3572](https://github.com/safe-global/safe-client-gateway/pull/3572) - fix(tests): stop signature, chain ID and JWT test flakes (Merged)
- [#3589](https://github.com/safe-global/safe-client-gateway/pull/3589) - build(deps-dev): bump vitest from 4.1.10 to 5.0.3 (Merged)
- [#3558](https://github.com/safe-global/safe-client-gateway/pull/3558) - perf(relay): boot the relay controller spec's app once per file (Merged)
- [#3554](https://github.com/safe-global/safe-client-gateway/pull/3554) - perf: share the integration-test module cache and shard CI (Merged)
- [#3552](https://github.com/safe-global/safe-client-gateway/pull/3552) - perf: share the unit-test module cache across spec files (Merged)
- [#3551](https://github.com/safe-global/safe-client-gateway/pull/3551) - build: resolve #/ imports natively and type-check specs on TS 7 (Merged)
- [#3447](https://github.com/safe-global/safe-client-gateway/pull/3447) - feat: derive zerion support from its chain list, excluding testnets (Merged)
- [#3550](https://github.com/safe-global/safe-client-gateway/pull/3550) - fix: compute messagesTag from the latest modified message (Merged)
- [#3444](https://github.com/safe-global/safe-client-gateway/pull/3444) - fix(circuit-breaker): replace deprecated done() callback with Date.now mocking (Closed)
- [#3506](https://github.com/safe-global/safe-client-gateway/pull/3506) - fix(users): return the winning user id on a concurrent wallet insert (Merged)
- [#3262](https://github.com/safe-global/safe-client-gateway/pull/3262) - fix: await Fastify ready when initializing test apps (Merged)
- [#3242](https://github.com/safe-global/safe-client-gateway/pull/3242) - fix(tests): resolve remaining flaky tests after Vitest migration (Merged)
- [#3139](https://github.com/safe-global/safe-client-gateway/pull/3139) - chore(tests): reduce CI flakiness (clearMocks + seeded faker) (Merged)
- [#3136](https://github.com/safe-global/safe-client-gateway/pull/3136) - feat: replace Jest with Vitest (Merged)
- [#3162](https://github.com/safe-global/safe-client-gateway/pull/3162) - chore: Fix flaky unit test (Merged)
- [#3014](https://github.com/safe-global/safe-client-gateway/pull/3014) - fix: add missing app.close() teardown in integration tests (Merged)
- [#2992](https://github.com/safe-global/safe-client-gateway/pull/2992) - fix: allow subdomains for redirect url to test previews (Merged)
- [#2977](https://github.com/safe-global/safe-client-gateway/pull/2977) - fix(tests): resolve flaky tests from chain ID collisions and missing mock resets (Merged)
- [#2944](https://github.com/safe-global/safe-client-gateway/pull/2944) - feat(auth): mock external auth provider (Closed)
- [#2911](https://github.com/safe-global/safe-client-gateway/pull/2911) - refactor: proper test clean-up (Merged)
- [#2913](https://github.com/safe-global/safe-client-gateway/pull/2913) - refactor: use TestBlocklistModule for testing (Merged)
- [#2907](https://github.com/safe-global/safe-client-gateway/pull/2907) - fix: Preview transaction - Kiln flaky test (Merged)
- [#2903](https://github.com/safe-global/safe-client-gateway/pull/2903) - fix: integration tests (part 2) (Merged)
- [#2891](https://github.com/safe-global/safe-client-gateway/pull/2891) - chore: fix flaky tests (Merged)
- [#2890](https://github.com/safe-global/safe-client-gateway/pull/2890) - chore: separate unit from integration tests (Merged)
- [#2846](https://github.com/safe-global/safe-client-gateway/pull/2846) - tests: fix race condition in tests (Merged)
- [#2842](https://github.com/safe-global/safe-client-gateway/pull/2842) - Verify tests pass on feat/zerion-cache-per-address branch (Closed)
- [#2737](https://github.com/safe-global/safe-client-gateway/pull/2737) - fix: eliminate test flakiness across test suite (Closed)
- [#2806](https://github.com/safe-global/safe-client-gateway/pull/2806) - feat(portfolio): add X-Env testnet header for Zerion API requests (Merged)
- [#2781](https://github.com/safe-global/safe-client-gateway/pull/2781) - chores(tests): address flaky tests (Closed)

---

*This report was auto-generated by `scripts/analyze-flaky-tests.ts`.*
