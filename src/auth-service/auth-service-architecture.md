<!-- SPDX-License-Identifier: FSL-1.1-MIT -->

# Auth Service Architecture

This document describes the architecture for the auth service, which lives in this repository but deploys separately from the gateway.

## Overview

The auth service is designed to:

1. **Live in the same repository** as the gateway for code sharing
2. **Deploy separately** as an independent container
3. **Enable easy future extraction** to a dedicated repository

## Architecture Approach: Separate Entry Points with Dedicated Folder

The auth service lives in a dedicated `src/auth-service/` folder with its own entry point, app module, and configuration. This approach keeps all auth service bootstrap code together while sharing modules from the main codebase.

### Benefits

- **Clean separation** - all auth service code in one folder
- **Own configuration** - auth service doesn't load gateway config (chains, relay, email, etc.)
- **Easy future extraction** - copy the folder + shared modules
- **Direct code sharing** via imports from `@/modules/`, `@/datasources/`, etc.
- **Independent deployment** via separate Dockerfile

## Project Structure

```
src/
├── main.ts                         # Gateway entry point
├── app.module.ts                   # Gateway module
├── app.provider.ts                 # Gateway provider
├── auth-service/                   # Auth service (separate folder)
│   ├── main.ts                     # Auth service entry point
│   ├── app.module.ts               # Auth service module (minimal imports)
│   ├── app.provider.ts             # Auth service provider (custom Swagger)
│   └── config/
│       └── configuration.ts        # Auth-specific configuration only
├── modules/                        # Shared modules
│   ├── auth/                       # Used by auth service
│   ├── health/                     # Used by both
│   └── ...                         # Gateway-only modules
├── config/                         # Gateway configuration
└── datasources/                    # Shared datasources
```

## Files Created

| File                                       | Purpose                                    |
| ------------------------------------------ | ------------------------------------------ |
| `src/auth-service/main.ts`                 | Auth service entry point                   |
| `src/auth-service/app.module.ts`           | Auth service root module (minimal imports) |
| `src/auth-service/app.provider.ts`         | Auth service provider with Swagger config  |
| `src/auth-service/config/configuration.ts` | Auth-specific configuration (minimal)      |
| `Dockerfile.auth`                          | Auth service container definition          |

## Files Modified

| File                 | Change                                                                |
| -------------------- | --------------------------------------------------------------------- |
| `nest-cli.json`      | Added `projects` configuration for gateway and auth-service           |
| `package.json`       | Added auth service scripts (`start:auth`, `build:auth-service`, etc.) |
| `docker-compose.yml` | Added `auth-service`, `db-auth`, `redis-auth` services                |

## Module Structure

The auth service imports only what it needs:

```
AuthAppModule
├── PostgresDatabaseModule (database access)
├── AuthModule (SIWE + JWT authentication)
├── HealthModule (health checks)
├── CacheModule (Redis caching)
├── CircuitBreakerModule
├── ConfigurationModule (environment config)
├── NetworkModule (HTTP client)
├── RequestScopedLoggingModule (logging)
└── TypeOrmModule (ORM configuration)
```

## Database

### Separate Database Instance

The auth service uses its **own database instance**, separate from the gateway. This provides:

- Full isolation between services
- Independent scaling and maintenance
- Cleaner separation for future extraction
- No risk of schema conflicts

### Docker Compose Setup

In local development, a separate `db-auth` container runs on port 5434:

```yaml
db-auth:
  image: postgres:14.8-alpine
  ports:
    - '5434:5432'
  environment:
    POSTGRES_DB: safe-auth-service
```

### Migrations

Auth service migrations are shared with the gateway (same `migrations/` folder). When extracting to a dedicated repo, you'll need to:

1. Identify auth-specific migrations
2. Copy relevant migration files
3. Update migration table name if needed

## Redis

### Separate Redis Instance

The auth service uses its **own Redis instance** for caching, separate from the gateway:

In local development, `redis-auth` container runs on port 6380:

```yaml
redis-auth:
  image: redis/redis-stack:7.2.0-v10
  ports:
    - '6380:6379'
```

### Package.json Scripts

```bash
# Build auth service only
yarn build:auth-service

# Start auth service in development
yarn start:auth:dev

# Start auth service in production
yarn start:auth:prod
```

## Deployment

### Local Development

```bash
# Start both services
docker compose up web auth-service

# Gateway runs on port 3000
# Auth service runs on port 3001
```

### Docker Images

| Service | Image                                 | Tags                             |
| ------- | ------------------------------------- | -------------------------------- |
| Gateway | `safeglobal/safe-client-gateway-nest` | `staging`, `latest`, `{version}` |
| Auth    | `safeglobal/safe-auth-service`        | `staging`, `latest`, `{version}` |

## Verification

### Build Verification

```bash
yarn build:auth-service
ls -la dist/src/auth-service/main.js
```

### Health Check

```bash
# Start the service
yarn start:auth:prod

# Check health endpoint
curl http://localhost:3001/health
```

### Docker Verification

```bash
docker compose up auth-service
curl http://localhost:3001/health
```

## Auth Service Configuration

The auth service has its own minimal configuration file at `src/auth-service/config/configuration.ts`. This includes only what auth needs:

- `application.*` (env, port, CORS)
- `auth.*` (SIWE, JWT, service port, db, redis)
- `db.*` (ORM settings, migrations)
- `redis.*` (cache settings)
- `log.*` (logging)
- `features.*` (feature flags)
- `circuitBreaker.*` (resilience)
- `httpClient.*` (request timeout)

Gateway-specific config (chains, relay, email, balances, etc.) is NOT loaded by the auth service.

## Future Extraction Path

When ready to extract to a dedicated repository:

1. **Create new repository**
2. **Copy the auth-service folder:**
   - `src/auth-service/` (entry point, module, provider, config)
3. **Copy shared modules:**
   - `src/modules/auth/`
   - `src/modules/siwe/`
   - `src/modules/health/`
   - `src/datasources/jwt/`
   - `src/datasources/cache/`
   - `src/datasources/db/`
   - `src/config/` (ConfigurationModule, interfaces)
   - `src/logging/`
4. **Update import paths** from `@/` to local paths
5. **Add dependencies** to new `package.json`
6. **Update gateway** to call auth service via HTTP instead of direct imports
