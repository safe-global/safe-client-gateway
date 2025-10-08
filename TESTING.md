# Testing Guide

This document describes the testing strategy and organization for the Safe Client Gateway.

## Test Types

### Unit Tests (`.spec.ts`)

- **Purpose**: Test isolated logic without external dependencies
- **Count**: ~329 tests
- **Characteristics**:
  - All dependencies are mocked using `jest.fn()` or `MockedObjectDeep`
  - No real database, Redis, or external service connections
  - Fast execution (< 2 minutes)
  - Tests pure functions, schemas, entities, validators

### Integration Tests (`.integration.spec.ts`)

- **Purpose**: Test components with real infrastructure
- **Count**: ~7 tests
- **Characteristics**:
  - Use real database connections (Postgres + TypeORM)
  - Use real Redis/BullMQ queues
  - Test full NestJS module bootstrap
  - Slower execution (can take several minutes)
  - Tests critical integration points

## Running Tests

### Locally

```bash
# Run all unit tests (default, fast)
yarn test

# Run unit tests with coverage
yarn test:unit:cov

# Run integration tests (requires Docker services)
yarn test:integration

# Run integration tests with coverage
yarn test:integration:cov

# Run all tests (unit + integration)
yarn test:all

# Run in watch mode
yarn test:watch
```

### CI/CD

Tests run in parallel on GitHub Actions:

- **`unit-tests` job**: Runs ~329 unit tests without external services (~2 min)
- **`integration-tests` job**: Runs ~16 integration tests with Postgres, Redis, and RabbitMQ (~5-10 min)

## Test Patterns

### Unit Test Example

```typescript
// file.service.spec.ts
const mockRepository = {
  findOne: jest.fn(),
} as jest.MockedObjectDeep<Repository>;

it('should return data', async () => {
  mockRepository.findOne.mockResolvedValue(data);
  const result = await service.getData();
  expect(result).toEqual(data);
});
```

### Integration Test Example

```typescript
// file.repository.integration.spec.ts
let dataSource: DataSource;

beforeAll(async () => {
  // Create real test database
  dataSource = new DataSource({
    type: 'postgres',
    database: 'test-db',
    entities: [User, Wallet],
  });
  await dataSource.initialize();
});

afterAll(async () => {
  await dataSource.destroy();
});

it('should persist data to database', async () => {
  const user = await repository.save(userData);
  const found = await repository.findOne({ where: { id: user.id } });
  expect(found).toBeDefined();
});
```

## Running Integration Tests Locally

Integration tests require external services. Use Docker Compose:

```bash
# Start services
docker compose up -d postgres redis rabbitmq

# Set environment variables
export POSTGRES_TEST_DB=test-db
export POSTGRES_TEST_USER=postgres
export POSTGRES_TEST_PASSWORD=postgres
export POSTGRES_TEST_PORT=5433
export REDIS_HOST=localhost
export REDIS_PORT=6379

# Run integration tests
yarn test:integration
```

## Writing Tests

### When to Write Unit Tests

- Testing business logic
- Testing data transformations
- Testing validators and schemas
- Testing isolated functions
- Testing API controllers with mocked services

### When to Write Integration Tests

- Testing database repositories
- Testing message queue consumers
- Testing full request/response cycles
- Testing complex module interactions
- Testing critical infrastructure components

### Naming Conventions

- Unit tests: `*.spec.ts`
- Integration tests: `*.integration.spec.ts`
- E2E tests: `*.e2e-spec.ts`

Keep integration tests co-located with the code they test to maintain feature organization.

## Test Configuration

### Jest Configurations

- **`package.json`** (default): Runs unit tests only
- **`test/jest-unit.json`**: Explicitly runs unit tests, excludes `.integration.spec.ts` and `.e2e-spec.ts`
- **`test/jest-integration.json`**: Runs only `.integration.spec.ts` files
- **`test/jest-e2e.json`**: Legacy config for e2e tests only
- **`test/jest-all.json`**: Runs all tests

## Debugging Tests

```bash
# Debug unit tests
yarn test:debug

# Debug specific test file
yarn test:debug path/to/file.spec.ts

# Run tests with verbose output
yarn test --verbose
```

## Coverage

```bash
# Generate coverage report for unit tests
yarn test:unit:cov

# Generate coverage report for integration tests
yarn test:integration:cov

# View coverage report
open coverage/lcov-report/index.html
```

## Best Practices

1. **Keep tests co-located**: Place test files next to the code they test
2. **Use descriptive names**: Test file names should clearly indicate what they test
3. **Mock external dependencies**: Unit tests should not rely on external services
4. **Clean up resources**: Integration tests should clean up database connections
5. **Maintain fast unit tests**: Unit tests should run in milliseconds
6. **Use test factories**: Create reusable test data builders in `__tests__/*.factory.ts`
7. **Avoid test interdependencies**: Each test should be independent and idempotent
