# Quickstart: Service-Aware Feature Configuration Integration

**Feature Branch**: `001-service-aware-config`  
**Date**: 2026-02-04

## Prerequisites

- Node.js 22.x
- Yarn 4.x
- Docker (for Redis)
- Access to Config Service v2 endpoints

## Environment Setup

Add the following to your `.env` file:

```bash
# Existing required variables
SAFE_CONFIG_BASE_URI=https://safe-config.safe.global/
```

## Development Workflow

### 1. Start Dependencies

```bash
docker-compose up -d redis postgres
```

### 2. Install Dependencies

```bash
yarn install
```

### 3. Run Development Server

```bash
yarn start:dev
```

### 4. Test the New Endpoints

**Get all chains (v2)** (service key as query parameter):

```bash
curl http://localhost:3000/v2/chains?serviceKey=WALLET_WEB
```

**Get single chain (v2)**:

```bash
curl http://localhost:3000/v2/chains/1?serviceKey=WALLET_WEB
```

**Compare with v1** (should still work unchanged):

```bash
curl http://localhost:3000/v1/chains
curl http://localhost:3000/v1/chains/1
```

## Running Tests

### Unit Tests

```bash
# All unit tests
yarn test

# Specific to chains module
yarn test --testPathPattern=chains
```

### Integration Tests

```bash
# Requires running Docker dependencies
yarn test:integration --testPathPattern=chains.v2
```

## File Locations

| Component             | Path                                                   |
| --------------------- | ------------------------------------------------------ |
| v2 Controller         | `src/modules/chains/routes/v2/chains.v2.controller.ts` |
| v2 Service            | `src/modules/chains/routes/v2/chains.v2.service.ts`    |
| Config API v2 methods | `src/datasources/config-api/config-api.service.ts`     |
| Cache Router v2 keys  | `src/datasources/cache/cache.router.ts`                |
| Configuration         | `src/config/entities/configuration.ts`                 |

## Key Implementation Notes

1. **Service Key**: Passed as required query parameter (e.g. `/v2/chains?serviceKey=WALLET_WEB` or `/v2/chains/1?serviceKey=WALLET_WEB`)

2. **Cache Isolation**: v2 endpoints use separate cache keys (`chains_v2_{serviceKey}`) to prevent pollution

3. **No Fallback**: v2 endpoints do NOT fallback to v1 on error - they propagate Config Service v2 errors

4. **Internal Components**: Internal components (TransactionApiManager, etc.) continue using v1 - only the new external v2 endpoints use Config Service v2

## Troubleshooting

### "Config Service v2 unavailable" errors

Verify the Config Service v2 endpoints are accessible:

```bash
curl "https://safe-config.safe.global/api/v2/chains/WALLET_WEB/"
```

### Cache issues

Clear Redis cache:

```bash
docker-compose exec redis redis-cli FLUSHALL
```

### Service key not recognized

Ensure the service key is registered in Config Service. Common values:

- `WALLET_WEB`
- `MOBILE`
- `CGW`

## API Documentation

Once running, Swagger UI is available at:

```
http://localhost:3000/api
```

The v2 chains endpoints will appear under the "chains" tag.
