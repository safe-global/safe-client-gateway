# SPDX-License-Identifier: FSL-1.1-MIT

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Safe Client Gateway is a NestJS-based backend service that acts as a bridge between Safe{Wallet} clients (Android, iOS, Web) and various Safe{Core} services. It provides UI-oriented data structures and mappings for frontend consumption.

## Development Commands

### Building and Running

```bash
# Install dependencies (enables corepack first)
corepack enable && yarn install

# Generate ABIs (runs automatically after install)
yarn generate-abis

# Start development server (requires Redis running)
docker compose up -d redis
yarn start:dev

# Build for production
yarn build

# Start production server
yarn start:prod
```

### Testing

```bash
# Start test database (required for unit tests with DB)
chmod 0600 db_config/test/server.key
docker compose up -d db-test

# Run tests
yarn test                    # All tests
yarn test:unit              # Unit tests only
yarn test:unit:cov          # Unit tests with coverage
yarn test:integration       # Integration tests
yarn test:e2e               # E2E tests (requires Redis and RabbitMQ)
yarn test:all               # All test suites
yarn test:watch             # Watch mode
yarn test:cov               # Coverage report

# Run a single test file
yarn test path/to/test.spec.ts
```

### Linting and Formatting

```bash
yarn lint                   # Run ESLint with auto-fix
yarn lint-check             # Run ESLint without fixing
yarn format                 # Format code with Prettier
yarn format-check           # Check formatting without fixing
```

### Database Migrations

```bash
# Migrations run automatically by default
# To disable: set RUN_MIGRATIONS=false and DB_MIGRATIONS_EXECUTE=false

yarn migration:create MigrationName    # Create new migration
yarn migration:generate MigrationName  # Generate from entities
yarn migration:run                     # Run pending migrations
yarn migration:revert                  # Revert last migration
```

Migration entity files must follow: `src/**/entities/*.entity.db.ts`

## Architecture

### Layered Structure

The codebase follows a three-layer architecture:

1. **Routes Layer** (`src/routes/`)
   - Controllers that handle HTTP requests
   - API entities (DTOs) decorated with Swagger/OpenAPI annotations
   - Mappers to transform domain entities to API entities
   - NestJS modules that wire up the route dependencies

2. **Domain Layer** (`src/domain/`)
   - Business logic and domain services
   - Domain entities (internal data models)
   - Repository interfaces (abstractions over data sources)
   - Repository implementations that coordinate multiple datasources

3. **Datasources Layer** (`src/datasources/`)
   - External API clients (e.g., `config-api`, `transaction-api`, `zerion-api`)
   - Infrastructure services (cache, database, network, logging, job queues)
   - Low-level data access implementations

### Dependency Flow

```
Routes (Controllers) → Domain (Services/Repositories) → Datasources (APIs/Infrastructure)
```

- Routes depend on Domain services
- Domain depends on Datasource implementations through interfaces
- Datasources have no dependencies on Domain or Routes

### Key Patterns

#### Dependency Injection via Symbols

Services and repositories are injected using symbols rather than class references:

```typescript
export const IChainsRepository = Symbol('IChainsRepository');

// In module:
providers: [
  { provide: IChainsRepository, useClass: ChainsRepository }
]

// In consumer:
constructor(
  @Inject(IChainsRepository)
  private readonly chainsRepository: IChainsRepository,
) {}
```

#### Validation with Zod

- All external data is validated using Zod schemas
- Schemas are colocated with entities: `entities/*.schema.ts`
- Use `ValidationPipe` with Zod schemas for query parameter validation

#### Configuration Service

- All configuration accessed via `IConfigurationService`
- Never hardcode values; use `configurationService.getOrThrow('path.to.config')`
- Configuration files: `src/config/entities/`

#### Mapper Pattern

- Complex transformations between domain and API entities use dedicated mapper files
- Mappers are pure functions located alongside controllers: `{feature}.mapper.ts`

#### Repository Pattern

- Domain repositories abstract data source access
- Repository interfaces define contracts: `{feature}.repository.interface.ts`
- Repository implementations in domain layer coordinate multiple datasources

### Module Organization

Each feature typically has:

```
src/routes/{feature}/
  ├── {feature}.controller.ts       # HTTP endpoints
  ├── {feature}.service.ts          # Route-level orchestration
  ├── {feature}.mapper.ts           # Domain ↔ API entity mapping
  ├── {feature}.module.ts           # NestJS module
  └── entities/
      └── {entity}.entity.ts        # API DTOs with @ApiProperty decorators

src/domain/{feature}/
  ├── {feature}.service.ts          # Business logic
  ├── {feature}.repository.ts       # Data access implementation
  ├── {feature}.repository.interface.ts  # Repository contract
  └── entities/
      ├── {entity}.entity.ts        # Domain models
      └── {entity}.schema.ts        # Zod validation schemas

src/datasources/{feature}-api/
  ├── {feature}-api.service.ts      # External API client
  ├── {feature}-api.module.ts       # Module configuration
  └── entities/
      └── {entity}.entity.ts        # Raw API response types
```

### Testing Strategy

- **Unit tests** (`*.spec.ts`): Test individual classes/functions in isolation
- **Integration tests** (`*.integration.spec.ts`): Test module integration with real dependencies
- **E2E tests** (`*.e2e-spec.ts`): Test complete request/response flows
- **Builders**: Use `Builder<T>` pattern for test data (located in `__tests__/` directories)
- Test constants should be defined at module level, above `describe` blocks

### Infrastructure

- **Caching**: Redis-based caching via `CacheModule` (from `@/datasources/cache`)
- **Logging**: Always use `ILoggingService` interface, never NestJS `Logger` directly
- **Database**: PostgreSQL via TypeORM with entity files: `*.entity.db.ts`
- **Job Queue**: BullMQ with Redis backend
- **HTTP Client**: Abstracted through `NetworkService`

### Path Aliases

The project uses TypeScript path aliases:

- `@/` maps to `src/`
- `@/abis/` maps to `abis/`

## General

Reduce comments to an absolute minimum. Comments should mainly be js docs.

# Code Quality Guidelines

This document captures learnings from PR reviews to maintain consistent code quality standards.

## Testing Best Practices

### Test Structure

- **Move constants above describe blocks**: Test constants that don't change per test should be defined at the module level, above the `describe` block, not inside it

  ```typescript
  // ✅ Good
  const address = getAddress(faker.finance.ethereumAddress());
  const fiatCode = 'USD';

  describe('MyTest', () => {
    it('should work', () => {
      /* ... */
    });
  });

  // ❌ Bad
  describe('MyTest', () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const fiatCode = 'USD';
    it('should work', () => {
      /* ... */
    });
  });
  ```

### Test Builders

- **Use the standard Builder pattern**: All test builders should use the project's `Builder` class, not custom builder classes

  ```typescript
  // ✅ Good
  export function pnlBuilder(): IBuilder<PnL> {
    return new Builder<PnL>()
      .with('realizedGain', 1000)
      .with('unrealizedGain', 500);
  }

  // ❌ Bad
  export class PnLBuilder {
    private realizedGain = 1000;
    withRealizedGain(value: number): PnLBuilder {
      /* ... */
    }
  }
  ```

### Test Purpose

- **Tests should validate schemas, not builders**: Schema tests should validate the schema's behavior (parsing, validation, error handling), not test the builder itself

  ```typescript
  // ✅ Good - Tests schema validation
  it('should validate valid PnL data', () => {
    const pnl = pnlBuilder().build();
    const result = PnLSchema.parse(pnl);
    expect(result).toEqual(pnl);
  });

  it('should reject invalid data', () => {
    const invalid = { realizedGain: 'string' };
    expect(() => PnLSchema.parse(invalid)).toThrow(ZodError);
  });

  // ❌ Bad - Tests builder, not schema
  it('should build PnL with values', () => {
    const pnl = pnlBuilder().with('realizedGain', 5000).build();
    expect(pnl.realizedGain).toBe(5000);
  });
  ```

- **Remove empty test files**: Don't keep test files that only contain documentation or placeholder tests with `expect(true).toBe(true)`. Either implement real tests or remove the file.

## Logging

### Use LoggingService, not Logger

- **Always use `LoggingService` interface**: Use the project's `LoggingService` interface instead of NestJS's `Logger` class directly

  ```typescript
  // ✅ Good
  import { ILoggingService, LoggingService } from '@/logging/logging.interface';

  @Injectable()
  export class MyService {
    constructor(
      @Inject(LoggingService)
      private readonly loggingService: ILoggingService,
    ) {}

    someMethod() {
      this.loggingService.warn('Warning message');
    }
  }

  // ❌ Bad
  import { Logger } from '@nestjs/common';

  @Injectable()
  export class MyService {
    private readonly logger = new Logger(MyService.name);

    someMethod() {
      this.logger.warn('Warning message');
    }
  }
  ```

## API Documentation

### Avoid Real Examples in API Specs

- **Don't use real names or data in examples**: Remove `example` fields from `@ApiProperty` decorators, especially if they contain real-looking personal data

  ```typescript
  // ✅ Good
  @ApiPropertyOptional({
    type: 'number',
    description: 'Total balance in fiat currency',
    nullable: true,
  })
  balanceFiat!: number | null;

  // ❌ Bad
  @ApiPropertyOptional({
    type: 'number',
    description: 'Total balance in fiat currency',
    example: 15000.0,
    nullable: true,
  })
  balanceFiat!: number | null;
  ```

## Code Organization

### Separation of Concerns

#### Create Mappers for Complex Transformations

- **Extract mapping logic to dedicated mapper files**: When transforming domain entities to API entities, create separate mapper functions for testability

  ```typescript
  // ✅ Good - portfolio.mapper.ts
  export function mapTokenBalance(token: DomainTokenBalance): TokenBalance {
    return {
      tokenInfo: { /* ... */ },
      balance: token.balance,
      // ...
    };
  }

  export function mapToApiPortfolio(domain: DomainPortfolio): Portfolio {
    return {
      tokenBalances: domain.tokenBalances.map(mapTokenBalance),
      // ...
    };
  }

  // portfolio.service.ts
  return mapToApiPortfolio(domainPortfolio);

  // ❌ Bad - Inline mapping in service
  private _mapToApiPortfolio(domain: DomainPortfolio): Portfolio {
    return {
      tokenBalances: domain.tokenBalances.map((token) => ({
        tokenInfo: {
          address: token.tokenInfo.address ?? NULL_ADDRESS,
          // ... 20 more lines
        },
        // ...
      })),
    };
  }
  ```

#### Document Interfaces with JSDoc

- **Add JSDoc to public interfaces**: All public interface methods should have JSDoc comments explaining parameters and return values

  ```typescript
  // ✅ Good
  export interface IPortfolioApi {
    /**
     * Retrieves the portfolio data for a given wallet address.
     *
     * @param args.address - The wallet address
     * @param args.fiatCode - The fiat currency code (e.g., 'USD', 'EUR')
     * @param args.chainIds - Optional array of chain IDs to filter by
     * @returns A promise that resolves to the portfolio data
     */
    getPortfolio(args: {
      address: Address;
      fiatCode: string;
      chainIds?: Array<string>;
    }): Promise<Raw<Portfolio>>;
  }

  // ❌ Bad
  export interface IPortfolioApi {
    getPortfolio(args: {
      address: Address;
      fiatCode: string;
      chainIds?: Array<string>;
    }): Promise<Raw<Portfolio>>;
  }
  ```

## Type Safety

### Use Enums for Known String Values

- **Create enums instead of string types**: When you have a known set of string values (like provider names), use TypeScript enums

  ```typescript
  // ✅ Good
  export enum PortfolioProvider {
    ZAPPER = 'zapper',
    ZERION = 'zerion',
  }

  private _getProviderApi(provider: string): IPortfolioApi {
    switch (provider as PortfolioProvider) {
      case PortfolioProvider.ZAPPER:
        return this.zapperPortfolioApi;
      case PortfolioProvider.ZERION:
        return this.zerionPortfolioApi;
    }
  }

  // ❌ Bad - Magic strings
  private _getProviderApi(provider: string): IPortfolioApi {
    if (provider === 'zapper') {
      return this.zapperPortfolioApi;
    } else if (provider === 'zerion') {
      return this.zerionPortfolioApi;
    }
  }
  ```

### Create Zod Schemas for Query Parameters

- **Validate query params with Zod schemas**: Instead of parsing query parameters manually, create dedicated Zod schemas

  ```typescript
  // ✅ Good
  export const ChainIdsSchema = z
    .string()
    .optional()
    .transform((val) => val?.split(',').map((id) => id.trim()))
    .pipe(z.array(NumericStringSchema).optional());

  @Get('/portfolio/:address')
  async getPortfolio(
    @Query('chainIds', new ValidationPipe(ChainIdsSchema))
    chainIds?: Array<string>,
  ) { /* ... */ }

  // ❌ Bad - Manual parsing
  @Get('/portfolio/:address')
  async getPortfolio(
    @Query('chainIds') chainIdsStr?: string,
  ) {
    const chainIds = chainIdsStr?.split(',').map(id => id.trim());
    // ...
  }
  ```

## Configuration

### Extract Constants to Configuration

- **Move hardcoded values to config**: Magic numbers and threshold values should be in configuration, not hardcoded in the code

  ```typescript
  // ✅ Good
  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.dustThresholdUsd = this.configurationService.getOrThrow<number>(
      'portfolio.filters.dustThresholdUsd',
    );
  }

  // ❌ Bad
  private readonly DUST_THRESHOLD_USD = 1.0;
  ```

- **Store uppercase values in config**: If you need values in uppercase, store them that way in configuration rather than transforming them at runtime

  ```typescript
  // ✅ Good - Config already has uppercase values
  this.fiatCodes = this.configurationService.getOrThrow<Array<string>>(
    'balances.providers.zerion.currencies',
  );

  // ❌ Bad - Transforming every time
  this.fiatCodes = this.configurationService
    .getOrThrow<Array<string>>('balances.providers.zerion.currencies')
    .map((currency) => currency.toUpperCase());
  ```

## Code Cleanliness

### Extract Complex Logic to Private Methods

- **Break down complex methods**: When you have complex filtering or transformation logic, extract it to well-named private methods

  ```typescript
  // ✅ Good
  async getPortfolio(args: GetPortfolioArgs): Promise<Portfolio> {
    const portfolio = await this._fetchPortfolio(args);
    return this._applyFilters(portfolio, args);
  }

  private _applyFilters(
    portfolio: Portfolio,
    args: FilterArgs,
  ): Portfolio {
    return this._filterPortfolio(
      portfolio,
      (token) => this._shouldIncludeToken(token, args),
      (position) => this._shouldIncludePosition(position, args),
    );
  }

  // ❌ Bad - Everything in one method
  async getPortfolio(args: GetPortfolioArgs): Promise<Portfolio> {
    const portfolio = await this._fetchPortfolio(args);
    const filtered = {
      ...portfolio,
      tokenBalances: portfolio.tokenBalances.filter(t => {
        if (args.chainIds && !args.chainIds.includes(t.chainId)) return false;
        if (args.excludeDust && t.balanceFiat < this.dustThreshold) return false;
        // ... 10 more lines
      }),
    };
    // ... more filtering
    return filtered;
  }
  ```

### Remove Unnecessary Code

- **Don't use optional chaining when type guarantees non-null**: If the type definition says a value is never undefined, don't use `?? null`

  ```typescript
  // ✅ Good - Type says it's always defined
  return {
    realizedGain: response.data.attributes.realized_gain,
  };

  // ❌ Bad - Unnecessary null coalescing
  return {
    realizedGain: response.data.attributes.realized_gain ?? null,
  };
  ```

## Configuration & Validation

- **Use data-driven config over hardcoded versions**: Use `Record<string, string>` (JSON env vars) instead of `v1`, `v2` fields. Module code stays version-agnostic; adding v3 needs zero code changes.
- **Reference enums in Zod schemas**: Use `z.enum([MyEnum.A, MyEnum.B])` instead of duplicating string literals. Single source of truth.
- **Enforce security-critical choices in schema**: If `local` is dev-only and `aws` is for production, add a `superRefine` check — don't just require the right fields.
- **Validate all key material at construction time**: Fail fast with clear messages for wrong lengths, missing versions, invalid hex.

## Production Code Hygiene

- **No test-only methods in production classes**: Use bracket notation (`Class['privateField'] = null`) in tests instead of adding `reset()` or `clearForTest()` methods.
- **Use explicit `public` access modifiers**: TypeScript defaults to public, but explicit modifiers communicate intent.
- **Don't expose internals in interfaces**: If callers get a value through return types (e.g. `encrypt().version`), don't duplicate it as an interface property.
- **Keep PRs focused**: Unrelated eslint changes, reformats, or opportunistic cleanup belong in separate PRs.

## Testing

- **Use faker for test data**: `faker.string.hexadecimal({ length: 64, prefix: '' })` over `'a'.repeat(64)`. Realistic data exercises more code paths.
- **Test your validation paths**: If you add `superRefine` checks, add the fields to `validConfiguration` and the `it.each` block. Untested validation is false confidence.

---

## Summary Checklist for New PRs

Before submitting a PR, verify:

- [ ] All test builders use the standard `Builder` pattern
- [ ] Test constants are defined at module level, not inside `describe` blocks
- [ ] Schema tests validate the schema, not the builder
- [ ] No empty test files with placeholder tests
- [ ] Using `LoggingService` interface, not `Logger` class
- [ ] No `example` fields in API property decorators
- [ ] Complex mappings extracted to dedicated mapper files
- [ ] Public interfaces have JSDoc comments
- [ ] Known string values use enums
- [ ] Query parameters validated with Zod schemas
- [ ] Configuration values extracted from code
- [ ] Complex logic broken into well-named private methods
- [ ] No unnecessary `?? null` or optional chaining
- [ ] No test-only methods in production code
- [ ] Security-critical config enforced in schema for prod/staging
- [ ] PRs contain only related changes
