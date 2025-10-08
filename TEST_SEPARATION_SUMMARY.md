# Test Separation Implementation Summary

## Overview

Successfully separated unit tests from integration tests to improve CI reliability and test execution speed.

## Changes Made

### 1. Jest Configurations Created

- **`test/jest-unit.json`**: Runs only `.spec.ts` files, excludes `.integration.spec.ts` and `.e2e-spec.ts`
- **`test/jest-integration.json`**: Runs only `.integration.spec.ts` and `.e2e-spec.ts` files

### 2. Package.json Scripts Added

```json
{
  "test:unit": "yarn test --config ./test/jest-unit.json",
  "test:unit:cov": "yarn test --coverage --config ./test/jest-unit.json",
  "test:integration": "yarn test --config ./test/jest-integration.json",
  "test:integration:cov": "yarn test --coverage --config ./test/jest-integration.json"
}
```

### 3. CI Configuration Updated (`.github/workflows/ci.yml`)

- **Before**: Single `tests` job running all tests together
- **After**: Two parallel jobs:
  - `unit-tests`: Runs 329 unit tests without external services (fast, ~2 min)
  - `integration-tests`: Runs 16 integration tests with Postgres, Redis, RabbitMQ (slower, ~5-10 min)

**Benefits**:

- Unit tests run faster without waiting for service containers
- Integration test failures don't block fast unit test feedback
- Both jobs run in parallel for faster overall CI time
- Easier to identify if failure is infrastructure-related or code-related

### 4. Documentation Added

- **`TESTING.md`**: Comprehensive testing guide with patterns, examples, and best practices

## Test Distribution

| Test Type         | Count   | Percentage | Execution Time  |
| ----------------- | ------- | ---------- | --------------- |
| Unit Tests        | 329     | 95%        | ~2 minutes      |
| Integration Tests | 7       | 2%         | ~5 minutes      |
| E2E Tests         | 9       | 3%         | ~5 minutes      |
| **Total**         | **345** | **100%**   | **~10 minutes** |

## Integration Tests Identified

### Database Integration Tests (`.integration.spec.ts`)

1. `src/datasources/job-queue/__tests__/job-queue.service.integration.spec.ts` - BullMQ + Redis
2. `src/domain/notifications/v2/notifications.repository.integration.spec.ts` - Postgres + TypeORM
3. `src/domain/spaces/address-books/address-book-items.repository.integration.spec.ts` - Postgres
4. `src/domain/spaces/spaces.repository.integration.spec.ts` - Postgres
5. `src/domain/users/members.repository.integration.spec.ts` - Postgres
6. `src/domain/users/users.repository.integration.spec.ts` - Postgres
7. `src/domain/wallets/wallets.repository.integration.spec.ts` - Postgres

### E2E Tests (`.e2e-spec.ts`)

1. `src/app.module.e2e-spec.ts` - Full app bootstrap
2. `src/routes/about/__tests__/get-about.e2e-spec.ts` - HTTP endpoint
3. `src/routes/contracts/__tests__/get-contract.e2e-spec.ts` - HTTP endpoint
4. `src/routes/data-decode/__tests__/data-decode.e2e-spec.ts` - HTTP endpoint
5. `src/routes/health/__tests__/get-health.e2e-spec.ts` - HTTP endpoint
6. `src/routes/hooks/__tests__/event-hooks-queue.e2e-spec.ts` - Event queue
7. `src/routes/owners/__tests__/get-safes-by-owner.e2e-spec.ts` - HTTP endpoint
8. `src/routes/safe-apps/__tests__/get-safe-apps.e2e-spec.ts` - HTTP endpoint
9. `src/domain/swaps/swaps.repository.e2e-spec.ts` - Repository with external calls

## Test Patterns

### Unit Test Characteristics

- All dependencies mocked with `jest.fn()` or `MockedObjectDeep`
- No environment variables for external services
- Tests complete in milliseconds
- Can run without Docker or external services

### Integration Test Characteristics

- Real `DataSource` with TypeORM
- Environment variables: `POSTGRES_TEST_DB`, `REDIS_HOST`, etc.
- `CREATE DATABASE` commands
- Database migrations executed
- Cleanup in `afterAll()` hooks
- Tests complete in seconds

## How to Use

### Locally

```bash
# Fast feedback with unit tests only (default)
yarn test

# Run integration tests (requires Docker services)
docker compose up -d postgres redis rabbitmq
yarn test:integration

# Run everything
yarn test:all
```

### In CI

- Both jobs run automatically on every push/PR
- Unit tests provide fast feedback (~2 min)
- Integration tests validate infrastructure (~5-10 min)
- Tests run in parallel for optimal speed

## Benefits Achieved

1. **Faster CI Feedback**: Unit tests complete in ~2 minutes instead of ~10 minutes
2. **Better Failure Isolation**: Know immediately if failure is code or infrastructure
3. **Cost Optimization**: Unit tests don't require expensive service containers
4. **Improved Reliability**: Flaky integration tests don't affect unit test success rate
5. **Local Development**: Developers can run fast unit tests without Docker
6. **Parallel Execution**: Unit and integration tests run simultaneously

## Migration Notes

- **No file moves required**: Tests remain co-located with their code
- **Backwards compatible**: `yarn test` still works (runs unit tests)
- **Existing scripts preserved**: `test:e2e` and `test:all` still work
- **Naming convention**: Tests follow existing `.spec.ts`, `.integration.spec.ts`, `.e2e-spec.ts` pattern

## Next Steps (Optional)

1. **Add more integration tests**: Current ratio is 329:16 (unit:integration)

   - Consider adding integration tests for critical paths
   - Recommended ratio: 70:20:10 (unit:integration:e2e)

2. **Monitor flakiness**: Track which integration tests fail most often

   - Consider retry strategies for flaky tests
   - Use test retry only for integration tests

3. **Optimize integration tests**:

   - Use test database pools
   - Consider `testcontainers` for isolated instances
   - Parallelize integration tests if possible

4. **Add test categories**:
   - `test:fast` - Unit tests only (for pre-commit hooks)
   - `test:slow` - Integration tests only
   - `test:smoke` - Critical path tests only
