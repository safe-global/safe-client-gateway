# Flaky Test Baseline Report

Generated: 2026-07-07T22:42:44.444Z | Period: 2026-01-16 to 2026-07-07

## Summary

| Metric | Value |
|--------|-------|
| Total unique commits | 1673 |
| Flaky commits (pass + fail on same SHA) | 103 |
| Flakiness rate | 6.2% |
| Cascade baseline | 1 failures (8 tests) |

## Weekly Trend

| Week | Commits | Flaky | Rate |
|------|---------|-------|------|
| 2026-01-12 | 7 | 1 | 14.3% |
| 2026-01-19 | 37 | 7 | 18.9% |
| 2026-01-26 | 65 | 10 | 15.4% |
| 2026-02-02 | 74 | 4 | 5.4% |
| 2026-02-09 | 72 | 5 | 6.9% |
| 2026-02-15 | 1 | 1 | 100% |
| 2026-02-16 | 79 | 3 | 3.8% |
| 2026-02-23 | 57 | 1 | 1.8% |
| 2026-03-02 | 71 | 5 | 7% |
| 2026-03-08 | 3 | 0 | 0% |
| 2026-03-09 | 44 | 1 | 2.3% |
| 2026-03-16 | 31 | 3 | 9.7% |
| 2026-03-23 | 59 | 3 | 5.1% |
| 2026-03-30 | 38 | 2 | 5.3% |
| 2026-04-06 | 116 | 11 | 9.5% |
| 2026-04-13 | 11 | 0 | 0% |
| 2026-04-20 | 19 | 1 | 5.3% |
| 2026-04-27 | 109 | 9 | 8.3% |
| 2026-05-03 | 9 | 1 | 11.1% |
| 2026-05-04 | 129 | 7 | 5.4% |
| 2026-05-10 | 1 | 0 | 0% |
| 2026-05-11 | 39 | 1 | 2.6% |
| 2026-05-17 | 1 | 0 | 0% |
| 2026-05-18 | 79 | 9 | 11.4% |
| 2026-05-25 | 60 | 4 | 6.7% |
| 2026-06-01 | 106 | 6 | 5.7% |
| 2026-06-07 | 3 | 0 | 0% |
| 2026-06-08 | 80 | 2 | 2.5% |
| 2026-06-15 | 66 | 6 | 9.1% |
| 2026-06-21 | 7 | 0 | 0% |
| 2026-06-22 | 71 | 0 | 0% |
| 2026-06-28 | 3 | 0 | 0% |
| 2026-06-29 | 81 | 0 | 0% |
| 2026-07-05 | 3 | 0 | 0% |
| 2026-07-06 | 42 | 0 | 0% |

```text
Weekly CI flakiness rate %  ·  n = unique commits  ·  weeks with n<10 omitted

01-19  18.9%  n=37   ████████████████████████████████████████
01-26  15.4%  n=65   █████████████████████████████████
02-02   5.4%  n=74   ███████████
02-09   6.9%  n=72   ███████████████
02-16   3.8%  n=79   ████████
02-23   1.8%  n=57   ████
03-02   7.0%  n=71   ███████████████
03-09   2.3%  n=44   █████
03-16   9.7%  n=31   █████████████████████
03-23   5.1%  n=59   ███████████
03-30   5.3%  n=38   ███████████
04-06   9.5%  n=116  ████████████████████
04-13   0.0%  n=11   ▏
04-20   5.3%  n=19   ███████████
04-27   8.3%  n=109  ██████████████████
05-04   5.4%  n=129  ███████████
05-11   2.6%  n=39   ██████
05-18  11.4%  n=79   ████████████████████████
05-25   6.7%  n=60   ██████████████
06-01   5.7%  n=106  ████████████
06-08   2.5%  n=80   █████
06-15   9.1%  n=66   ███████████████████
06-22   0.0%  n=71   ▏
06-29   0.0%  n=81   ▏
07-06   0.0%  n=42   ▏
```

## Flaky Test Leaderboard (Non-Cascade)

| File | Failures | Status | Fix PR |
|------|----------|--------|--------|
| `src/modules/transactions/routes/__tests__/controllers/preview-transaction-kiln.transactions.controller.integration.spec.ts` | 20 | Fixed | [#2890](https://github.com/safe-global/safe-client-gateway/pull/2890) |
| `src/modules/transactions/routes/__tests__/controllers/preview-transaction-cow-swap.transactions.controller.integration.spec.ts` | 13 | Fixed | [#2890](https://github.com/safe-global/safe-client-gateway/pull/2890) |
| `src/modules/targeted-messaging/datasources/targeted-messaging.datasource.integration.spec.ts` | 12 | Fixed | [#2891](https://github.com/safe-global/safe-client-gateway/pull/2891) |
| `src/routes/common/guards/rate-limit.guard.spec.ts` | 10 | Fixed | [#3139](https://github.com/safe-global/safe-client-gateway/pull/3139) |
| `src/datasources/job-queue/__tests__/job-queue.service.integration.spec.ts` | 9 | Open | [#2781](https://github.com/safe-global/safe-client-gateway/pull/2781) |
| `src/datasources/cache/redis.cache.service.integration.spec.ts` | 9 | Fixed | [#3136](https://github.com/safe-global/safe-client-gateway/pull/3136) |
| `src/modules/transactions/routes/__tests__/controllers/propose-transaction.transactions.controller.integration.spec.ts` | 8 | Fixed | [#2890](https://github.com/safe-global/safe-client-gateway/pull/2890) |
| `src/modules/notifications/routes/v2/notifications.controller.integration.spec.ts` | 7 | Fixed | [#2890](https://github.com/safe-global/safe-client-gateway/pull/2890) |
| `src/modules/transactions/routes/mappers/common/transaction-data.mapper.spec.ts` | 7 | Open | - |
| `src/modules/safe-shield/recipient-analysis/recipient-analysis.service.spec.ts` | 6 | Fixed | [#2977](https://github.com/safe-global/safe-client-gateway/pull/2977) |
| `src/modules/transactions/routes/helpers/transaction-verifier.helper.spec.ts` | 6 | Fixed | [#2891](https://github.com/safe-global/safe-client-gateway/pull/2891) |
| `src/modules/users/domain/members.repository.integration.spec.ts` | 5 | Fixed | [#2891](https://github.com/safe-global/safe-client-gateway/pull/2891) |
| `src/modules/transactions/routes/__tests__/controllers/add-transaction-confirmations.transactions.controller.integration.spec.ts` | 5 | Fixed | [#2890](https://github.com/safe-global/safe-client-gateway/pull/2890) |
| `src/domain/common/entities/safe-signature.spec.ts` | 4 | Fixed | [#3136](https://github.com/safe-global/safe-client-gateway/pull/3136) |
| `src/modules/users/domain/users.repository.integration.spec.ts` | 3 | Open | - |
| `src/modules/transactions/routes/__tests__/controllers/get-transaction-by-id.transactions.controller.integration.spec.ts` | 2 | Fixed | [#2890](https://github.com/safe-global/safe-client-gateway/pull/2890) |
| `src/modules/users/domain/__tests__/user-identity-resolver.service.spec.ts` | 2 | Open | - |

## Cascade Tests

These 8 tests all failed exactly 1 times, suggesting they fail together as a cascade (e.g., shared infrastructure issue).

<details>
<summary>Click to expand cascade test list</summary>

- `src/modules/transactions/routes/__tests__/controllers/preview-transaction-cow-swap.transactions.controller.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/preview-transaction-kiln.transactions.controller.spec.ts`
- `src/modules/safe-shield/safe-shield.controller.integration.spec.ts`
- `src/modules/safe-apps/routes/safe-apps.controller.integration.spec.ts`
- `src/modules/bridge/domain/entities/bridge-name.entity.spec.ts`
- `src/modules/auth/routes/auth.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/preview-transaction.transactions.controller.integration.spec.ts`
- `src/modules/messages/domain/helpers/message-verifier.helper.spec.ts`

</details>

## Fix PRs

- [#3139](https://github.com/safe-global/safe-client-gateway/pull/3139) - chore(tests): reduce CI flakiness (clearMocks + seeded faker) (Merged)
- [#3136](https://github.com/safe-global/safe-client-gateway/pull/3136) - feat: replace Jest with Vitest (Merged)
- [#3162](https://github.com/safe-global/safe-client-gateway/pull/3162) - chore: Fix flaky unit test (Merged)
- [#3014](https://github.com/safe-global/safe-client-gateway/pull/3014) - fix: add missing app.close() teardown in integration tests (Merged)
- [#2992](https://github.com/safe-global/safe-client-gateway/pull/2992) - fix: allow subdomains for redirect url to test previews (Merged)
- [#2977](https://github.com/safe-global/safe-client-gateway/pull/2977) - fix(tests): resolve flaky tests from chain ID collisions and missing mock resets (Merged)
- [#2944](https://github.com/safe-global/safe-client-gateway/pull/2944) - feat(auth): mock external auth provider (Open)
- [#2911](https://github.com/safe-global/safe-client-gateway/pull/2911) - refactor: proper test clean-up (Merged)
- [#2913](https://github.com/safe-global/safe-client-gateway/pull/2913) - refactor: use TestBlocklistModule for testing (Merged)
- [#2907](https://github.com/safe-global/safe-client-gateway/pull/2907) - fix: Preview transaction - Kiln flaky test (Merged)
- [#2903](https://github.com/safe-global/safe-client-gateway/pull/2903) - fix: integration tests (part 2) (Merged)
- [#2891](https://github.com/safe-global/safe-client-gateway/pull/2891) - chore: fix flaky tests (Merged)
- [#2890](https://github.com/safe-global/safe-client-gateway/pull/2890) - chore: separate unit from integration tests (Merged)
- [#2846](https://github.com/safe-global/safe-client-gateway/pull/2846) - tests: fix race condition in tests (Merged)
- [#2842](https://github.com/safe-global/safe-client-gateway/pull/2842) - Verify tests pass on feat/zerion-cache-per-address branch (Open)
- [#2737](https://github.com/safe-global/safe-client-gateway/pull/2737) - fix: eliminate test flakiness across test suite (Open)
- [#2806](https://github.com/safe-global/safe-client-gateway/pull/2806) - feat(portfolio): add X-Env testnet header for Zerion API requests (Merged)
- [#2781](https://github.com/safe-global/safe-client-gateway/pull/2781) - chores(tests): address flaky tests (Open)

## Still-Open Flaky Tests

- `src/datasources/job-queue/__tests__/job-queue.service.integration.spec.ts` (9 failures)
- `src/modules/transactions/routes/mappers/common/transaction-data.mapper.spec.ts` (7 failures)
- `src/modules/users/domain/users.repository.integration.spec.ts` (3 failures)
- `src/modules/users/domain/__tests__/user-identity-resolver.service.spec.ts` (2 failures)

---

*This report was auto-generated by `scripts/analyze-flaky-tests.ts`. It will be superseded by Datadog Test Optimization (WA-1754).*
