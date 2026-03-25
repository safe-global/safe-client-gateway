# Testing Guide

This document describes the testing strategy and organization for the Safe Client Gateway.

## Test Types

### Unit Tests (`.spec.ts`)

- **Purpose**: Test individual components and business logic in isolation
- **Count**: ~309 tests
- **Characteristics**:
  - All external dependencies are mocked using `jest.fn()` or `MockedObjectDeep`
  - No real database, Redis, or external service connections
  - Fast execution (< 2 minutes)
  - Tests services, controllers, schemas, entities, validators with mocked dependencies

### Integration Tests (`.integration.spec.ts`)

- **Purpose**: Test components with real infrastructure and cross-module interactions
- **Count**: ~27 tests
- **Characteristics**:
  - Use real database connections (Postgres + TypeORM)
  - Use real Redis/BullMQ queues
  - Test database repositories, migrations, and data access layers
  - Test full NestJS module bootstrap and end-to-end flows
  - Slower execution (can take several minutes)
  - Require Postgres, Redis, and RabbitMQ services to be running

## Running Tests

### Locally

```bash
# Run all unit tests (default config from package.json)
bun test

# Run unit tests explicitly (uses test/jest-unit.json config)
bun test:unit

# Run unit tests with coverage
bun test:unit:cov

# Run integration tests (uses test/jest-integration.json config)
bun test:integration

# Run integration tests with coverage
bun test:integration:cov

# Run all tests (unit + integration)
bun test:all

# Run in watch mode
bun test:watch
```

**Note**: Both `bun test` and `bun test:unit` run the same unit tests, but `bun test` uses the default Jest configuration from `package.json` while `bun test:unit` explicitly uses `test/jest-unit.json`.

### CI/CD

Tests run in parallel on GitHub Actions:

- **`unit-tests` job**: Runs ~309 unit tests without external services (~2 min)
- **`integration-tests` job**: Runs ~27 integration tests with Postgres, Redis, and RabbitMQ services (~5-10 min)
- **`tests` job**: Aggregates results from both test jobs for branch protection

Both jobs run in parallel and report coverage to Coveralls.

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
bun test:integration
```

**Note**: Unit tests (`bun test` or `bun test:unit`) do NOT require these services and can run without Docker.

## Writing Tests

### When to Write Unit Tests

- Testing business logic in services
- Testing data transformations
- Testing validators and schemas
- Testing isolated functions
- Testing API controllers with mocked services
- Testing components with all external dependencies mocked

### When to Write Integration Tests

- Testing database repositories and data access layers
- Testing database migrations
- Testing full module bootstrap and initialization
- Testing message queue consumers with real queue infrastructure
- Testing complete request/response cycles through multiple layers
- Testing complex interactions between multiple modules
- Testing critical end-to-end workflows with real infrastructure

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
bun test:debug

# Debug specific test file
bun test:debug path/to/file.spec.ts

# Run tests with verbose output
bun test --verbose
```

## Coverage

```bash
# Generate coverage report for unit tests
bun test:unit:cov

# Generate coverage report for integration tests
bun test:integration:cov

# View coverage report
open coverage/lcov-report/index.html
```

## Best Practices

1. **Keep tests co-located**: Place test files next to the code they test
2. **Use descriptive names**: Test file names should clearly indicate what they test
3. **Mock all external dependencies in unit tests**: Unit tests should mock databases, caches, HTTP APIs, and all I/O
4. **Use real infrastructure for integration tests**: Test database repositories, migrations, and queues against real services
5. **Clean up resources**: Integration tests must clean up database connections and test data
6. **Maintain fast unit tests**: Unit tests should run quickly without I/O (< 2 minutes for the full suite)
7. **Use test factories**: Create reusable test data builders in `__tests__/*.factory.ts`
8. **Avoid test interdependencies**: Each test should be independent and idempotent
9. **Choose the right test type**: If your test needs real infrastructure, it's an integration test (`.integration.spec.ts`)
