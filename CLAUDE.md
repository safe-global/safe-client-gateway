# Safe Client Gateway - Project Documentation

## Project Overview

The Safe Client Gateway is a NestJS-based backend service that serves as a bridge between Safe Wallet clients (Android, iOS, Web) and various Safe Core services. It provides UI-oriented mappings and data structures for easier integration with blockchain and Safe ecosystem services.

**Key Features:**

- RESTful API gateway for Safe wallet applications
- Multi-chain blockchain integration
- Transaction processing and decoding
- User account management with spaces/organizations
- Push notifications and messaging
- Staking, swaps, and bridge integrations
- Comprehensive caching layer with Redis

## Technology Stack

- **Framework:** NestJS 11.x (Node.js TypeScript framework)
- **Runtime:** Node.js v22.15.0 LTS
- **Database:** PostgreSQL with TypeORM
- **Cache:** Redis Stack 7.2.0
- **Message Queue:** RabbitMQ with AMQP
- **Background Jobs:** BullMQ with Redis
- **Package Manager:** Yarn 4.1.1
- **Testing:** Jest with extensive unit and e2e tests
- **Linting:** ESLint with TypeScript support
- **Formatting:** Prettier
- **Blockchain:** Viem for Ethereum interactions

## Architecture

### Directory Structure

```
src/
├── config/              # Configuration management with validation
├── datasources/         # External API integrations and data sources
│   ├── accounts/        # Account management (encryption, address books)
│   ├── alerts-api/      # Tenderly alerts integration
│   ├── balances-api/    # Token balances (CoinGecko, Zerion)
│   ├── blockchain/      # Blockchain API management
│   ├── bridge-api/      # LiFi bridge integration
│   ├── cache/           # Redis caching layer
│   ├── jobs/            # BullMQ background job processing
│   ├── push-notifications-api/ # Firebase messaging
│   ├── queues/          # RabbitMQ queue management
│   ├── staking-api/     # Kiln staking integration
│   ├── swaps-api/       # CowSwap integration
│   └── ...
├── domain/              # Business logic and repository interfaces
│   ├── accounts/        # Account domain logic
│   ├── chains/          # Blockchain network configurations
│   ├── safe/           # Safe wallet operations
│   ├── transactions/    # Transaction processing
│   ├── spaces/         # User spaces/organizations
│   └── ...
├── routes/              # REST API controllers and services
│   ├── auth/           # Authentication endpoints
│   ├── jobs/           # Background job management endpoints
│   ├── safes/          # Safe wallet endpoints
│   ├── transactions/   # Transaction endpoints
│   ├── spaces/         # Spaces management
│   └── ...
├── logging/            # Winston-based logging
├── validation/         # Input validation pipes
└── main.ts            # Application bootstrap
```

### Architecture Patterns

- **Clean Architecture:** Clear separation between datasources, domain, and routes
- **Repository Pattern:** Abstract data access through interfaces
- **Dependency Injection:** NestJS modules with proper IoC
- **CQRS-like approach:** Separate read/write operations where applicable
- **Event-driven:** Hook system for blockchain events and notifications

## Development Setup

### Prerequisites

- Node.js v22.15.0 LTS
- Docker and Docker Compose
- Yarn package manager

### Installation

```bash
# Enable corepack and install dependencies
corepack enable && yarn install

# Generate ABIs (runs automatically after install)
yarn generate-abis

# Set up SSL permissions for test database
chmod 0600 db_config/test/server.key
```

### Environment Configuration

Copy `.env.sample` to `.env` and configure:

- Database connections (PostgreSQL)
- Redis configuration
- External API keys (CoinGecko, Infura, etc.)
- Authentication tokens
- Service endpoints

### Running the Application

```bash
# Start dependencies
docker compose up -d redis db

# Development mode with watch
yarn start:dev

# Production mode
yarn start:prod

# Debug mode
yarn start:debug
```

## Testing Strategy

### Test Types

- **Unit Tests:** `yarn test` - Domain logic and service testing
- **E2E Tests:** `yarn test:e2e` - Full application integration tests
- **Coverage:** `yarn test:cov` - Generate coverage reports

### Test Infrastructure

- Database tests use SSL-enabled PostgreSQL container
- Redis and RabbitMQ containers for integration tests
- Faker.js for test data generation
- Custom test builders and factories

### Running Tests

```bash
# Start test database
docker compose up -d db-test

# Run all tests
yarn test:all

# Run with coverage
yarn test:all:cov

# E2E tests with dependencies
docker-compose up -d redis rabbitmq && yarn test:e2e
```

## Database Management

### Migrations

- Auto-generated TypeORM migrations
- Entity files: `src/**/entities/*.entity.db.ts`
- Migration files: `migrations/`

```bash
# Generate migration
yarn migration:generate ./migrations/MigrationName

# Run migrations
yarn migration:run

# Revert migration
yarn migration:revert
```

### Database Configuration

- PostgreSQL with SSL support
- Connection pooling
- Automatic migration execution (configurable)

## API Structure

### Key Endpoints

- `/v1/chains` - Blockchain network information
- `/v1/safes/{address}` - Safe wallet operations
- `/v1/transactions` - Transaction management
- `/v2/spaces` - User spaces and organizations
- `/v1/balances` - Token balance queries
- `/v1/collectibles` - NFT information
- `/v1/hooks` - Webhook handlers for blockchain events
- `/jobs` - Background job status monitoring

### Authentication

- JWT-based authentication
- SIWE (Sign-In with Ethereum) support
- Optional authentication for public endpoints
- Custom guards for route protection

## External Integrations

### Blockchain & DeFi

- **Multi-chain support:** Ethereum, Polygon, Arbitrum, etc.
- **Safe deployments:** Integration with Safe protocol contracts
- **Staking:** Kiln API for staking operations
- **Swaps:** CowSwap protocol integration
- **Bridges:** LiFi for cross-chain operations

### Data Providers

- **CoinGecko:** Token prices and market data
- **Zerion:** Advanced balance aggregation
- **Tenderly:** Smart contract monitoring and alerts

### Infrastructure

- **Firebase:** Push notifications
- **AWS:** S3 storage and KMS encryption
- **Redis:** Caching and session management
- **RabbitMQ:** Asynchronous message processing

## Job Queue System (BullMQ)

BullMQ is integrated for background job processing. Jobs are managed through Redis-backed queues with NestJS processors.

### Key Endpoints

- `GET /jobs/:id/status` - Monitor job status and progress

### Adding New Jobs

1. Define job type in `src/datasources/jobs/types/job-types.ts`
2. Create Zod schema for data validation in `src/datasources/jobs/entities/schemas/`
3. Create processor extending `WorkerHost` with proper validation and error handling
4. Add comprehensive tests for all components

## Caching Strategy

- **Redis-based caching** with configurable TTL
- **Cache-first data sources** for performance
- **Layered caching** for different data types
- **Cache invalidation** through hooks and events

## Development Practices

### Code Quality

- **ESLint** with TypeScript rules
- **Prettier** for consistent formatting
- **Husky** git hooks for pre-commit checks
- **Strict TypeScript** configuration

### Patterns

- **Entity validation** with Zod schemas
- **DTO pattern** for API contracts
- **Builder pattern** for test data
- **Factory pattern** for service creation
- **Decorator pattern** for authentication and validation
- **Testing modules:** We usually don't test .module files.
- **Service file:** Create service files inside the routes layer and create repository files inside the datasource layer.
- **Import Modules:** Import Datasource modules in the routes layer and then import route layer modules in the main AppModule.
- **Throw errors:** Throw errors using NestJs error exception helpers e.g. `NotFoundException`, `UnprocessableEntityException` or `BadRequestException` from `@nestjs/common` library instead of returning them
- **Configuration constants:** Create config constants in the `src/domain/common/entities/` folder.
- **Mock Files:** Create mocks inside a new mock file dedicated to that mock in the test folder.
- **Comments:** Comment the method using JsDoc but comment code inside a method only if the code is not really readable.
- **Access Modifiers:** Add access modifiers to all the methods in every class.
- **Module Exports:** Always export modules/providers that other modules depend on for dependency injection (e.g., BullModule for queue injection).

## Deployment

### Docker

- Multi-stage Dockerfile for production builds
- Docker Compose for local development
- Environment-based configuration
- Health checks and monitoring

### Configuration

- Environment-specific settings
- Validation of required configuration
- Feature flags for gradual rollouts
- SSL/TLS support for secure connections

## Monitoring & Logging

- **Winston** structured logging
- **Health check endpoints** for monitoring
- **Error tracking** with proper exception handling
- **Performance metrics** through middleware

## Key Features

1. **Multi-chain Safe Operations:** Support for Safe wallets across multiple blockchain networks
2. **Transaction Decoding:** Comprehensive transaction decoding and human-readable descriptions
3. **User Spaces:** Organization and collaboration features for Safe users
4. **Real-time Notifications:** Push notifications for transaction events
5. **DeFi Integrations:** Staking, swapping, and bridging capabilities
6. **Comprehensive APIs:** Full REST API coverage for all Safe wallet functionality

This project represents a production-ready, enterprise-scale backend service with comprehensive testing, monitoring, and integration capabilities.

## Development Memories

- Run linting and code formatting and fix it after doing some changes
- Pay attention to security vulnerabilities
- Check for similar patterns in the app before implementing it.
- Ensure code coverage for all critical functionalities
- Check for latest documentation when introducing a new Technology to know more about it.
- run the test:cov at the end of the implementation and fix it.
