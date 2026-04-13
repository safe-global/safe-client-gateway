# Flaky Test Baseline Report

Generated: 2026-04-13T16:22:07.834Z | Period: 2026-01-16 to 2026-04-13

## Summary

| Metric | Value |
|--------|-------|
| Total unique commits | 765 |
| Flaky commits (pass + fail on same SHA) | 57 |
| Flakiness rate | 7.5% |
| Cascade baseline | 5 failures (6 tests) |

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

## Flaky Test Leaderboard (Non-Cascade)

| File | Failures | Status | Fix PR |
|------|----------|--------|--------|
| `src/modules/targeted-messaging/datasources/targeted-messaging.datasource.integration.spec.ts` | 12 | Fixed | [#2891](https://github.com/safe-global/safe-client-gateway/pull/2891) |
| `src/modules/transactions/routes/__tests__/controllers/preview-transaction-kiln.transactions.controller.integration.spec.ts` | 4 | Fixed | [#2890](https://github.com/safe-global/safe-client-gateway/pull/2890) |
| `src/modules/transactions/routes/__tests__/controllers/add-transaction-confirmations.transactions.controller.integration.spec.ts` | 4 | Fixed | [#2890](https://github.com/safe-global/safe-client-gateway/pull/2890) |
| `src/modules/notifications/routes/v2/notifications.controller.integration.spec.ts` | 4 | Fixed | [#2890](https://github.com/safe-global/safe-client-gateway/pull/2890) |
| `src/modules/transactions/routes/helpers/transaction-verifier.helper.spec.ts` | 3 | Fixed | [#2891](https://github.com/safe-global/safe-client-gateway/pull/2891) |
| `src/modules/transactions/routes/mappers/common/transaction-data.mapper.spec.ts` | 3 | Open | - |
| `src/routes/common/guards/rate-limit.guard.spec.ts` | 3 | Open | - |
| `src/modules/transactions/routes/__tests__/controllers/get-transaction-by-id.transactions.controller.integration.spec.ts` | 2 | Fixed | [#2890](https://github.com/safe-global/safe-client-gateway/pull/2890) |
| `src/modules/transactions/routes/__tests__/controllers/preview-transaction-cow-swap.transactions.controller.spec.ts` | 1 | Open | - |
| `src/modules/transactions/routes/__tests__/controllers/preview-transaction-kiln.transactions.controller.spec.ts` | 1 | Open | - |
| `src/modules/safe-shield/safe-shield.controller.integration.spec.ts` | 1 | Open | [#2842](https://github.com/safe-global/safe-client-gateway/pull/2842) |
| `src/modules/safe-apps/routes/safe-apps.controller.integration.spec.ts` | 1 | Fixed | [#2890](https://github.com/safe-global/safe-client-gateway/pull/2890) |
| `src/domain/common/entities/safe-signature.spec.ts` | 1 | Fixed | [#2647](https://github.com/safe-global/safe-client-gateway/pull/2647) |
| `src/modules/bridge/domain/entities/bridge-name.entity.spec.ts` | 1 | Open | - |

## Cascade Tests

These 6 tests all failed exactly 5 times, suggesting they fail together as a cascade (e.g., shared infrastructure issue).

<details>
<summary>Click to expand cascade test list</summary>

- `src/modules/users/domain/members.repository.integration.spec.ts`
- `src/modules/safe-shield/recipient-analysis/recipient-analysis.service.spec.ts`
- `src/datasources/cache/redis.cache.service.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/preview-transaction-cow-swap.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/propose-transaction.transactions.controller.integration.spec.ts`
- `src/datasources/job-queue/__tests__/job-queue.service.integration.spec.ts`

</details>

## Fix PRs

### [#3014](https://github.com/safe-global/safe-client-gateway/pull/3014) - fix: add missing app.close() teardown in integration tests (Merged)

- `src/modules/chains/routes/chains.controller.integration.spec.ts`
- `src/modules/delegate/routes/delegates.controller.integration.spec.ts`
- `src/modules/delegate/routes/v2/delegates.v2.controller.integration.spec.ts`
- `src/modules/messages/routes/messages.controller.integration.spec.ts`
- `src/modules/notifications/routes/v1/notifications.controller.integration.spec.ts`
- `src/modules/root/routes/root.controller.integration.spec.ts`
- `src/modules/safe/routes/safes.controller.nonces.integration.spec.ts`
- `src/routes/common/decorators/pagination.data.decorator.integration.spec.ts`
- `src/routes/common/interceptors/cache-control.interceptor.integration.spec.ts`

### [#2992](https://github.com/safe-global/safe-client-gateway/pull/2992) - fix: allow subdomains for redirect url to test previews (Merged)

- `src/modules/auth/oidc/routes/oidc-auth.controller.integration.spec.ts`
- `src/modules/auth/oidc/routes/oidc-auth.service.spec.ts`

### [#2977](https://github.com/safe-global/safe-client-gateway/pull/2977) - fix(tests): resolve flaky tests from chain ID collisions and missing mock resets (Merged)

- `src/modules/safe-shield/recipient-analysis/recipient-analysis.service.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/preview-transaction-cow-swap.transactions.controller.integration.spec.ts`

### [#2944](https://github.com/safe-global/safe-client-gateway/pull/2944) - feat(auth): mock external auth provider (Open)

- `src/modules/auth/datasources/__tests__/external-auth.mock.datasource.spec.ts`
- `src/modules/auth/routes/__tests__/mock-consent.controller.spec.ts`

### [#2911](https://github.com/safe-global/safe-client-gateway/pull/2911) - refactor: proper test clean-up (Merged)

- `src/datasources/db/v2/postgres-database.service.integration.spec.ts`
- `src/datasources/network/network.module.integration.spec.ts`
- `src/modules/alerts/routes/alerts.controller.integration.spec.ts`
- `src/modules/balances/routes/__tests__/controllers/zerion-balances.controller.integration.spec.ts`
- `src/modules/balances/routes/balances.controller.integration.spec.ts`
- `src/modules/collectibles/routes/__tests__/controllers/zerion-collectibles.controller.integration.spec.ts`
- `src/modules/collectibles/routes/collectibles.controller.integration.spec.ts`
- `src/modules/community/routes/community.controller.integration.spec.ts`
- `src/modules/contracts/routes/contracts.controller.integration.spec.ts`
- `src/modules/estimations/routes/estimations.controller.integration.spec.ts`
- `src/modules/hooks/routes/hooks-cache.integration.spec.ts`
- `src/modules/hooks/routes/hooks-notifications.integration.spec.ts`
- `src/modules/hooks/routes/hooks.controller.integration.spec.ts`
- `src/modules/notifications/routes/v2/notifications.controller.integration.spec.ts`
- `src/modules/owners/routes/owners.controller.v1.integration.spec.ts`
- `src/modules/owners/routes/owners.controller.v2.integration.spec.ts`
- `src/modules/owners/routes/owners.controller.v3.integration.spec.ts`
- `src/modules/relay/routes/relay.controller.integration.spec.ts`
- `src/modules/safe-apps/routes/safe-apps.controller.integration.spec.ts`
- `src/modules/safe-shield/safe-shield.controller.integration.spec.ts`
- `src/modules/safe/routes/safes.controller.integration.spec.ts`
- `src/modules/safe/routes/safes.controller.overview.integration.spec.ts`
- `src/modules/safe/routes/v2/__tests__/safes.v2.controller.overview.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/add-transaction-confirmations.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/delete-transaction.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/get-creation-transaction.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/get-transaction-by-id.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/list-incoming-transfers-by-safe.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/list-module-transactions-by-safe.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/list-multisig-transactions-by-safe.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/list-queued-transactions-by-safe.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/preview-transaction.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/propose-transaction.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/transactions-history.controller.integration.spec.ts`
- `src/modules/transactions/routes/transactions-history.imitation-transactions.controller.integration.spec.ts`
- `src/routes/common/filters/global-error.filter.integration.spec.ts`

### [#2913](https://github.com/safe-global/safe-client-gateway/pull/2913) - refactor: use TestBlocklistModule for testing (Merged)

- `src/modules/messages/domain/helpers/message-verifier.helper.spec.ts`
- `src/modules/messages/routes/messages.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/add-transaction-confirmations.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/get-transaction-by-id.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/list-queued-transactions-by-safe.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/propose-transaction.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/helpers/transaction-verifier.helper.spec.ts`

### [#2907](https://github.com/safe-global/safe-client-gateway/pull/2907) - fix: Preview transaction - Kiln flaky test (Merged)

- `src/modules/transactions/routes/__tests__/controllers/preview-transaction-kiln.transactions.controller.integration.spec.ts`

### [#2903](https://github.com/safe-global/safe-client-gateway/pull/2903) - fix: integration tests (part 2) (Merged)

- `src/modules/notifications/routes/v2/notifications.controller.integration.spec.ts`

### [#2891](https://github.com/safe-global/safe-client-gateway/pull/2891) - chore: fix flaky tests (Merged)

- `src/modules/spaces/domain/space-safes.repository.integration.spec.ts`
- `src/modules/spaces/domain/spaces.repository.integration.spec.ts`
- `src/modules/targeted-messaging/datasources/targeted-messaging.datasource.integration.spec.ts`
- `src/modules/transactions/routes/helpers/transaction-verifier.helper.spec.ts`
- `src/modules/users/domain/members.repository.integration.spec.ts`

### [#2890](https://github.com/safe-global/safe-client-gateway/pull/2890) - chore: separate unit from integration tests (Merged)

- `src/config/configuration.module.spec.ts`
- `src/datasources/db/v2/database-migrator.service.integration.spec.ts`
- `src/datasources/network/network.module.integration.spec.ts`
- `src/modules/alerts/routes/alerts.controller.integration.spec.ts`
- `src/modules/auth/routes/auth.controller.integration.spec.ts`
- `src/modules/auth/routes/decorators/auth.decorator.integration.spec.ts`
- `src/modules/auth/routes/guards/auth.guard.integration.spec.ts`
- `src/modules/auth/routes/guards/optional-auth.guard.integration.spec.ts`
- `src/modules/balances/routes/__tests__/controllers/zerion-balances.controller.integration.spec.ts`
- `src/modules/balances/routes/balances.controller.integration.spec.ts`
- `src/modules/bridge/datasources/lifi-api.service.spec.ts`
- `src/modules/chains/routes/chains.controller.integration.spec.ts`
- `src/modules/collectibles/routes/__tests__/controllers/zerion-collectibles.controller.integration.spec.ts`
- `src/modules/collectibles/routes/collectibles.controller.integration.spec.ts`
- `src/modules/community/routes/community.controller.integration.spec.ts`
- `src/modules/contracts/routes/contracts.controller.integration.spec.ts`
- `src/modules/delegate/routes/delegates.controller.integration.spec.ts`
- `src/modules/delegate/routes/v2/delegates.v2.controller.integration.spec.ts`
- `src/modules/estimations/routes/estimations.controller.integration.spec.ts`
- `src/modules/health/routes/health.controller.integration.spec.ts`
- `src/modules/hooks/routes/hooks-cache.integration.spec.ts`
- `src/modules/hooks/routes/hooks-notifications.integration.spec.ts`
- `src/modules/hooks/routes/hooks.controller.integration.spec.ts`
- `src/modules/hooks/routes/hooks.controller.spec.ts`
- `src/modules/hooks/routes/hooks.http.controller.spec.ts`
- `src/modules/messages/routes/messages.controller.integration.spec.ts`
- `src/modules/notifications/routes/v1/notifications.controller.integration.spec.ts`
- `src/modules/notifications/routes/v2/notifications.controller.integration.spec.ts`
- `src/modules/portfolio/v1/portfolio.controller.spec.ts`
- `src/modules/positions/routes/positions.controller.spec.ts`
- `src/modules/recovery/routes/recovery.controller.integration.spec.ts`
- `src/modules/relay/routes/relay.controller.integration.spec.ts`
- `src/modules/root/routes/root.controller.integration.spec.ts`
- `src/modules/safe-apps/routes/safe-apps.controller.integration.spec.ts`
- `src/modules/safe-shield/safe-shield.controller.integration.spec.ts`
- `src/modules/safe/routes/safes.controller.integration.spec.ts`
- `src/modules/safe/routes/safes.controller.nonces.integration.spec.ts`
- `src/modules/safe/routes/safes.controller.overview.integration.spec.ts`
- `src/modules/safe/routes/v2/__tests__/safes.v2.controller.overview.integration.spec.ts`
- `src/modules/targeted-messaging/routes/targeted-messaging.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/add-transaction-confirmations.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/delete-transaction.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/get-creation-transaction.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/get-transaction-by-id.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/list-incoming-transfers-by-safe.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/list-module-transactions-by-safe.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/list-multisig-transactions-by-safe.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/list-queued-transactions-by-safe.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/preview-transaction-cow-swap.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/preview-transaction-kiln.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/preview-transaction.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/__tests__/controllers/propose-transaction.transactions.controller.integration.spec.ts`
- `src/modules/transactions/routes/transactions-history.controller.integration.spec.ts`
- `src/modules/transactions/routes/transactions-history.imitation-transactions.controller.integration.spec.ts`
- `src/routes/common/decorators/pagination.data.decorator.integration.spec.ts`
- `src/routes/common/filters/global-error.filter.integration.spec.ts`
- `src/routes/common/filters/zod-error.filter.integration.spec.ts`
- `src/routes/common/interceptors/cache-control.interceptor.integration.spec.ts`
- `src/routes/common/interceptors/route-logger.interceptor.integration.spec.ts`

### [#2846](https://github.com/safe-global/safe-client-gateway/pull/2846) - tests: fix race condition in tests (Merged)

- `src/modules/transactions/routes/transactions-history.imitation-transactions.controller.spec.ts`

### [#2842](https://github.com/safe-global/safe-client-gateway/pull/2842) - Verify tests pass on feat/zerion-cache-per-address branch (Open)

- `src/modules/safe-shield/safe-shield.controller.integration.spec.ts`
- `src/modules/safe-shield/threat-analysis/blockaid/blockaid-api.service.spec.ts`
- `src/modules/safe-shield/threat-analysis/blockaid/schemas/blockaid-scan-response.schema.spec.ts`
- `src/modules/safe-shield/threat-analysis/threat-analysis.service.spec.ts`

### [#2737](https://github.com/safe-global/safe-client-gateway/pull/2737) - fix: eliminate test flakiness across test suite (Open)

- `src/datasources/blockchain/blockchain-api.manager.spec.ts`
- `src/datasources/job-queue/__tests__/job-queue.service.integration.spec.ts`
- `src/datasources/jwt/__tests__/jwt-claims.entity.schema.spec.ts`
- `src/domain/common/utils/__tests__/number.spec.ts`
- `src/domain/notifications/v2/notifications.repository.integration.spec.ts`
- `src/domain/spaces/address-books/address-book-items.repository.integration.spec.ts`
- `src/domain/spaces/space-safes.repository.spec.ts`
- `src/domain/spaces/spaces.repository.integration.spec.ts`
- `src/domain/users/members.repository.integration.spec.ts`
- `src/domain/users/users.repository.integration.spec.ts`
- `src/domain/wallets/wallets.repository.integration.spec.ts`
- `src/logging/__tests__/logger-factory.spec.ts`
- `src/modules/csv-export/csv-utils/csv.service.spec.ts`
- `src/modules/csv-export/v1/csv-export.service.spec.ts`
- `src/routes/alerts/alerts.controller.spec.ts`
- `src/routes/auth/auth.controller.spec.ts`
- `src/routes/users/users.controller.spec.ts`

### [#2806](https://github.com/safe-global/safe-client-gateway/pull/2806) - feat(portfolio): add X-Env testnet header for Zerion API requests (Merged)

- `src/modules/balances/datasources/zerion-api.helpers.spec.ts`
- `src/modules/balances/datasources/zerion-balances-api.service.spec.ts`
- `src/modules/balances/routes/__tests__/controllers/zerion-balances.controller.spec.ts`
- `src/modules/collectibles/routes/__tests__/controllers/zerion-collectibles.controller.spec.ts`
- `src/modules/portfolio/v1/portfolio.service.spec.ts`

### [#2781](https://github.com/safe-global/safe-client-gateway/pull/2781) - chores(tests): address flaky tests (Open)

- `src/datasources/job-queue/__tests__/job-queue.service.integration.spec.ts`
- `src/domain/spaces/spaces.repository.integration.spec.ts`
- `src/domain/users/members.repository.integration.spec.ts`
- `src/domain/users/users.repository.integration.spec.ts`
- `src/routes/relay/relay.controller.spec.ts`
- `src/routes/safes/safes.controller.overview.spec.ts`
- `src/routes/spaces/space-safes.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/preview-transaction-cow-swap.transactions.controller.spec.ts`

### [#2740](https://github.com/safe-global/safe-client-gateway/pull/2740) - Tests: Separate unit and integration tests into parallel CI jobs (Merged)

- `migrations/deprecated/__tests__/00001_accounts.integration.spec.ts`
- `migrations/deprecated/__tests__/00002_account-data-types.integration.spec.ts`
- `migrations/deprecated/__tests__/00003_account-data-settings.integration.spec.ts`
- `migrations/deprecated/__tests__/00004_counterfactual-safes.integration.spec.ts`
- `migrations/deprecated/__tests__/00005_notifications.integration.spec.ts`
- `migrations/deprecated/__tests__/00006_targeted_messaging.integration.spec.ts`
- `migrations/deprecated/__tests__/00007_targeted_messaging_update.integration.spec.ts`
- `migrations/deprecated/__tests__/00008_targeted_messaging_add_outreach_1.integration.spec.ts`
- `migrations/deprecated/__tests__/00009_account-names.integration.spec.ts`
- `migrations/deprecated/__tests__/00010_account-indexes.integration.spec.ts`
- `migrations/deprecated/__tests__/00011_address-books.integration.spec.ts`
- `migrations/deprecated/__tests__/00013_targeted_messaging_add_outreach_2.integration.spec.ts`
- `migrations/deprecated/__tests__/_all.integration.spec.ts`
- `src/datasources/accounts/accounts.datasource.integration.spec.ts`
- `src/datasources/accounts/address-books/address-books.datasource.integration.spec.ts`
- `src/datasources/accounts/counterfactual-safes/counterfactual-safes.datasource.integration.spec.ts`
- `src/datasources/db/v1/postgres-database.migration.hook.integration.spec.ts`
- `src/datasources/db/v1/postgres-database.migrator.integration.spec.ts`
- `src/datasources/targeted-messaging/outreach-file-processor.integration.spec.ts`
- `src/datasources/targeted-messaging/targeted-messaging.datasource.integration.spec.ts`
- `src/modules/csv-export/v1/csv-export.service.spec.ts`

### [#2708](https://github.com/safe-global/safe-client-gateway/pull/2708) - Fix tests for multisig transaction notes (Merged)

- `src/routes/transactions/__tests__/controllers/list-multisig-transactions-by-safe.transactions.controller.spec.ts`
- `src/routes/transactions/transactions-history.controller.spec.ts`

### [#2238](https://github.com/safe-global/safe-client-gateway/pull/2238) - Remove `FakeCacheService` and `TestCacheModule` (Open)

- `src/datasources/accounts/accounts.datasource.spec.ts`
- `src/datasources/accounts/counterfactual-safes/counterfactual-safes.datasource.spec.ts`
- `src/datasources/blockchain/blockchain-api.manager.spec.ts`
- `src/datasources/cache/__tests__/fake.cache.service.spec.ts`
- `src/datasources/cache/cache.first.data.source.spec.ts`
- `src/datasources/db/v1/cached-query-resolver.spec.ts`
- `src/datasources/db/v1/postgres-database.module.spec.ts`
- `src/datasources/push-notifications-api/firebase-cloud-messaging-api.service.spec.ts`
- `src/datasources/relay-api/gelato-api.service.spec.ts`
- `src/datasources/siwe-api/siwe-api.service.spec.ts`
- `src/datasources/targeted-messaging/outreach-file-processor.spec.ts`
- `src/datasources/targeted-messaging/targeted-messaging.datasource.spec.ts`
- `src/domain/hooks/hooks.repository.spec.ts`
- `src/routes/accounts/accounts.controller.spec.ts`
- `src/routes/accounts/address-books/address-books.controller.spec.ts`
- `src/routes/accounts/counterfactual-safes/counterfactual-safes.controller.spec.ts`
- `src/routes/alerts/alerts.controller.spec.ts`
- `src/routes/auth/auth.controller.spec.ts`
- `src/routes/auth/guards/auth.guard.spec.ts`
- `src/routes/auth/guards/optional-auth.guard.spec.ts`
- `src/routes/balances/__tests__/controllers/zerion-balances.controller.spec.ts`
- `src/routes/balances/balances.controller.spec.ts`
- `src/routes/chains/chains.controller.spec.ts`
- `src/routes/collectibles/__tests__/controllers/zerion-collectibles.controller.spec.ts`
- `src/routes/collectibles/collectibles.controller.spec.ts`
- `src/routes/community/community.controller.spec.ts`
- `src/routes/contracts/contracts.controller.spec.ts`
- `src/routes/delegates/delegates.controller.spec.ts`
- `src/routes/delegates/v2/delegates.v2.controller.spec.ts`
- `src/routes/estimations/estimations.controller.spec.ts`
- `src/routes/health/health.controller.spec.ts`
- `src/routes/hooks/hooks-cache.spec.ts`
- `src/routes/hooks/hooks-notifications.spec.ts`
- `src/routes/hooks/hooks.controller.spec.ts`
- `src/routes/hooks/hooks.http.controller.spec.ts`
- `src/routes/messages/messages.controller.spec.ts`
- `src/routes/notifications/v1/notifications-v2compatible.controller.spec.ts`
- `src/routes/notifications/v1/notifications.controller.spec.ts`
- `src/routes/notifications/v2/notifications.controller.spec.ts`
- `src/routes/owners/owners.controller.spec.ts`
- `src/routes/recovery/recovery.controller.spec.ts`
- `src/routes/relay/relay.controller.spec.ts`
- `src/routes/root/root.controller.spec.ts`
- `src/routes/safe-apps/safe-apps.controller.spec.ts`
- `src/routes/safes/safes.controller.nonces.spec.ts`
- `src/routes/safes/safes.controller.overview.spec.ts`
- `src/routes/safes/safes.controller.spec.ts`
- `src/routes/targeted-messaging/targeted-messaging.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/add-transaction-confirmations.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/delete-transaction.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/get-creation-transaction.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/get-transaction-by-id.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/list-incoming-transfers-by-safe.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/list-module-transactions-by-safe.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/list-multisig-transactions-by-safe.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/list-queued-transactions-by-safe.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/preview-transaction-cow-swap.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/preview-transaction-kiln.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/preview-transaction.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/propose-transaction.transactions.controller.spec.ts`
- `src/routes/transactions/transactions-history.controller.spec.ts`
- `src/routes/transactions/transactions-history.imitation-transactions.controller.spec.ts`
- `src/routes/transactions/transactions-view.controller.spec.ts`

### [#2021](https://github.com/safe-global/safe-client-gateway/pull/2021) - `close` app `afterEach` test (Open)

- `src/routes/accounts/accounts.controller.spec.ts`
- `src/routes/accounts/counterfactual-safes/counterfactual-safes.controller.spec.ts`
- `src/routes/alerts/alerts.controller.spec.ts`
- `src/routes/auth/auth.controller.spec.ts`
- `src/routes/balances/__tests__/controllers/zerion-balances.controller.spec.ts`
- `src/routes/balances/balances.controller.spec.ts`
- `src/routes/collectibles/__tests__/controllers/zerion-collectibles.controller.spec.ts`
- `src/routes/collectibles/collectibles.controller.spec.ts`
- `src/routes/community/community.controller.spec.ts`
- `src/routes/contracts/contracts.controller.spec.ts`
- `src/routes/estimations/estimations.controller.spec.ts`
- `src/routes/hooks/hooks-cache.controller.spec.ts`
- `src/routes/hooks/hooks.controller.spec.ts`
- `src/routes/owners/owners.controller.spec.ts`
- `src/routes/recovery/recovery.controller.spec.ts`
- `src/routes/relay/relay.controller.spec.ts`
- `src/routes/safe-apps/safe-apps.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/add-transaction-confirmations.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/delete-transaction.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/get-creation-transaction.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/get-transaction-by-id.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/list-incoming-transfers-by-safe.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/list-module-transactions-by-safe.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/list-multisig-transactions-by-safe.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/list-queued-transactions-by-safe.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/preview-transaction-cow-swap.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/preview-transaction-kiln.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/preview-transaction.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/propose-transaction.transactions.controller.spec.ts`
- `src/routes/transactions/transactions-history.controller.spec.ts`
- `src/routes/transactions/transactions-history.imitation-transactions.controller.spec.ts`
- `src/routes/transactions/transactions-view.controller.spec.ts`

### [#2013](https://github.com/safe-global/safe-client-gateway/pull/2013) - Postgres v2 mock (Open)

- `migrations/deprecated/__tests__/00001_accounts.spec.ts`
- `migrations/deprecated/__tests__/00002_account-data-types.spec.ts`
- `migrations/deprecated/__tests__/00003_account-data-settings.spec.ts`
- `migrations/deprecated/__tests__/00004_counterfactual-safes.spec.ts`
- `migrations/deprecated/__tests__/00005_notifications.spec.ts`
- `migrations/deprecated/__tests__/00006_targeted_messaging.spec.ts`
- `migrations/deprecated/__tests__/_all.spec.ts`
- `src/config/configuration.module.spec.ts`
- `src/config/configuration.validator.spec.ts`
- `src/config/nest.configuration.service.spec.ts`
- `src/datasources/accounts/accounts.datasource.spec.ts`
- `src/datasources/accounts/counterfactual-safes/counterfactual-safes.datasource.spec.ts`
- `src/datasources/alerts-api/tenderly-api.service.spec.ts`
- `src/datasources/balances-api/balances-api.manager.spec.ts`
- `src/datasources/balances-api/coingecko-api.service.spec.ts`
- `src/datasources/balances-api/zerion-balances-api.service.spec.ts`
- `src/datasources/blockchain/blockchain-api.manager.spec.ts`
- `src/datasources/cache/cache.first.data.source.spec.ts`
- `src/datasources/cache/redis.cache.service.key-prefix.spec.ts`
- `src/datasources/cache/redis.cache.service.spec.ts`
- `src/datasources/config-api/config-api.service.spec.ts`
- `src/datasources/db/v1/cached-query-resolver.spec.ts`
- `src/datasources/db/v1/postgres-database.migration.hook.spec.ts`
- `src/datasources/db/v1/postgres-database.migrator.spec.ts`
- `src/datasources/db/v1/postgres-database.module.spec.ts`
- `src/datasources/db/v2/database-migrator.service.spec.ts`
- `src/datasources/db/v2/postgres-database.module.spec.ts`
- `src/datasources/db/v2/postgres-database.service.spec.ts`
- `src/datasources/email-api/pushwoosh-api.service.spec.ts`
- `src/datasources/jwt/jwt.service.spec.ts`
- `src/datasources/locking-api/locking-api.service.spec.ts`
- `src/datasources/network/fetch.network.service.spec.ts`
- `src/datasources/network/network.module.spec.ts`
- `src/datasources/notifications/notifications.datasource.spec.ts`
- `src/datasources/push-notifications-api/firebase-cloud-messaging-api.service.spec.ts`
- `src/datasources/queues/queues-api.service.spec.ts`
- `src/datasources/relay-api/gelato-api.service.spec.ts`

### [#1734](https://github.com/safe-global/safe-client-gateway/pull/1734) - Generate specific function/event decoders in `AbiDecoder` (Open)

- `src/domain/alerts/contracts/decoders/__tests__/delay-modifier-decoder.helper.spec.ts`
- `src/domain/contracts/contracts/__tests__/abi-decoder.helper.spec.ts`
- `src/domain/contracts/decoders/__tests__/abi-decoder.helper.spec.ts`
- `src/domain/contracts/decoders/__tests__/multi-send-decoder.helper.spec.ts`
- `src/domain/contracts/decoders/__tests__/safe-decoder.helper.spec.ts`
- `src/domain/relay/contracts/decoders/__tests__/erc20-decoder.helper.spec.ts`
- `src/domain/relay/contracts/decoders/__tests__/proxy-factory-decoder.helper.spec.ts`
- `src/domain/relay/limit-addresses.mapper.spec.ts`
- `src/domain/swaps/contracts/decoders/composable-cow-decoder.helper.spec.ts`
- `src/domain/swaps/contracts/decoders/gp-v2-decoder.helper.spec.ts`
- `src/routes/transactions/helpers/gp-v2-order.helper.spec.ts`
- `src/routes/transactions/helpers/twap-order.helper.spec.ts`
- `src/routes/transactions/mappers/common/twap-order.mapper.spec.ts`

### [#1676](https://github.com/safe-global/safe-client-gateway/pull/1676) - Refactor `AbiDecoder['decodeFunctionData']` to specify function name (Open)

- `src/domain/contracts/decoders/__tests__/safe-decoder.helper.spec.ts`
- `src/domain/relay/contracts/decoders/__tests__/erc20-decoder.helper.spec.ts`
- `src/domain/relay/contracts/decoders/__tests__/proxy-factory-decoder.helper.spec.ts`
- `src/domain/swaps/contracts/decoders/gp-v2-decoder.helper.spec.ts`
- `src/routes/transactions/mappers/common/swap-order.mapper.spec.ts`
- `src/routes/transactions/mappers/common/twap-order.mapper.spec.ts`

### [#2668](https://github.com/safe-global/safe-client-gateway/pull/2668) - test(spaces): overrides`SpacesCreationRateLimitGuard` to `SpaceSafesController` tests (Merged)

- `src/routes/spaces/space-safes.controller.spec.ts`

### [#2647](https://github.com/safe-global/safe-client-gateway/pull/2647) - fix(test): flaky tests (Merged)

- `src/domain/common/entities/safe-signature.spec.ts`
- `src/routes/notifications/v2/notifications.controller.spec.ts`
- `src/routes/transactions/transactions-history.imitation-transactions.controller.spec.ts`

### [#2644](https://github.com/safe-global/safe-client-gateway/pull/2644) - chore(test): refactor tests to use common TestingModule (Merged)

- `src/domain/notifications/v2/entities/__tests__/delete-all-subscriptions.dto.entity.spec.ts`
- `src/routes/accounts/accounts.controller.spec.ts`
- `src/routes/accounts/address-books/address-books.controller.spec.ts`
- `src/routes/accounts/counterfactual-safes/counterfactual-safes.controller.spec.ts`
- `src/routes/alerts/alerts.controller.spec.ts`
- `src/routes/auth/auth.controller.spec.ts`
- `src/routes/balances/__tests__/controllers/zerion-balances.controller.spec.ts`
- `src/routes/balances/balances.controller.spec.ts`
- `src/routes/chains/chains.controller.spec.ts`
- `src/routes/collectibles/__tests__/controllers/zerion-collectibles.controller.spec.ts`
- `src/routes/collectibles/collectibles.controller.spec.ts`
- `src/routes/community/community.controller.spec.ts`
- `src/routes/contracts/contracts.controller.spec.ts`
- `src/routes/delegates/delegates.controller.spec.ts`
- `src/routes/delegates/v2/delegates.v2.controller.spec.ts`
- `src/routes/estimations/estimations.controller.spec.ts`
- `src/routes/health/health.controller.spec.ts`
- `src/routes/hooks/hooks-cache.spec.ts`
- `src/routes/hooks/hooks-notifications.spec.ts`
- `src/routes/hooks/hooks.controller.spec.ts`
- `src/routes/hooks/hooks.http.controller.spec.ts`
- `src/routes/messages/messages.controller.spec.ts`
- `src/routes/notifications/v1/notifications.controller.spec.ts`
- `src/routes/notifications/v2/notifications.controller.spec.ts`
- `src/routes/owners/owners.controller.v1.spec.ts`
- `src/routes/owners/owners.controller.v2.spec.ts`
- `src/routes/recovery/recovery.controller.spec.ts`
- `src/routes/relay/relay.controller.spec.ts`
- `src/routes/root/root.controller.spec.ts`
- `src/routes/safe-apps/safe-apps.controller.spec.ts`
- `src/routes/safes/safes.controller.nonces.spec.ts`
- `src/routes/safes/safes.controller.overview.spec.ts`
- `src/routes/safes/safes.controller.spec.ts`
- `src/routes/spaces/address-books.controller.spec.ts`
- `src/routes/spaces/members.controller.spec.ts`
- `src/routes/spaces/space-safes.controller.spec.ts`
- `src/routes/spaces/spaces.controller.spec.ts`
- `src/routes/targeted-messaging/targeted-messaging.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/delete-transaction.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/get-creation-transaction.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/get-transaction-by-id.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/list-incoming-transfers-by-safe.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/list-module-transactions-by-safe.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/list-multisig-transactions-by-safe.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/list-queued-transactions-by-safe.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/preview-transaction-cow-swap.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/preview-transaction-kiln.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/preview-transaction.transactions.controller.spec.ts`
- `src/routes/transactions/__tests__/controllers/propose-transaction.transactions.controller.spec.ts`
- `src/routes/transactions/transactions-history.controller.spec.ts`
- `src/routes/transactions/transactions-history.imitation-transactions.controller.spec.ts`
- `src/routes/users/users.controller.spec.ts`

### [#2643](https://github.com/safe-global/safe-client-gateway/pull/2643) - refactor: Remove unused chainId variable from LimitAddressesMapper tests to fix a flaky test (Merged)

- `src/domain/relay/limit-addresses.mapper.spec.ts`

### [#2588](https://github.com/safe-global/safe-client-gateway/pull/2588) - feat: Add ORM query cache key and Redis integration for notifications tests (Merged)

- `src/domain/notifications/v2/notifications.repository.integration.spec.ts`

## Still-Open Flaky Tests

- `src/modules/transactions/routes/mappers/common/transaction-data.mapper.spec.ts` (3 failures)
- `src/routes/common/guards/rate-limit.guard.spec.ts` (3 failures)
- `src/modules/transactions/routes/__tests__/controllers/preview-transaction-cow-swap.transactions.controller.spec.ts` (1 failures)
- `src/modules/transactions/routes/__tests__/controllers/preview-transaction-kiln.transactions.controller.spec.ts` (1 failures)
- `src/modules/safe-shield/safe-shield.controller.integration.spec.ts` (1 failures)
- `src/modules/bridge/domain/entities/bridge-name.entity.spec.ts` (1 failures)

---

*This report was auto-generated by `scripts/analyze-flaky-tests.ts`. It will be superseded by Datadog Test Optimization (WA-1754).*
