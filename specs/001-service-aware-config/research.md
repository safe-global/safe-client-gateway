# Research: Service-Aware Feature Configuration Integration

**Feature Branch**: `001-service-aware-config`  
**Date**: 2026-02-04

## Research Tasks

### 1. Config Service v2 API Structure

**Task**: Verify Config Service v2 endpoint structure and response format.

**Decision**: Use Config Service v2 endpoints as documented:

- `GET /api/v2/chains/{service_key}/` - List all chains for service
- `GET /api/v2/chains/{service_key}/{chain_id}/` - Get single chain for service

**Rationale**: Matches the spec assumptions. The response format is expected to be compatible with existing Chain entity schema (same fields, scoped features).

**Alternatives considered**:

- Query parameter approach (`?service_key=frontend`) - Rejected: Config Service uses path-based approach

### 2. Service Key Configuration Pattern

**Task**: Determine how to configure the service key in CGW.

**Decision**: Add `safeConfig.serviceKey` configuration with environment variable `CONFIG_SERVICE_FRONTEND_KEY`, defaulting to `"frontend"`.

**Rationale**:

- Follows existing configuration patterns in `configuration.ts`
- Environment variable allows runtime configuration without code changes
- Default "frontend" per spec requirements (FR-005)

**Alternatives considered**:

- Feature flag approach - Rejected: Service key is a required parameter, not optional behavior
- Per-request header - Rejected: Spec requires CGW-level configuration, not per-request

### 3. Cache Key Strategy for v2 Endpoints

**Task**: Design cache key structure to prevent cross-service pollution.

**Decision**: Create new cache key methods that include service key:

- `getChainsCacheKeyV2(serviceKey)` → `chains_v2_{serviceKey}`
- `getChainCacheKeyV2(serviceKey, chainId)` → `{chainId}_chain_v2_{serviceKey}`

**Rationale**:

- Isolates v2 cache from v1 cache (different prefixes)
- Includes service key to prevent cross-service pollution
- Follows existing `CacheRouter` patterns

**Alternatives considered**:

- Reuse v1 cache keys with service key suffix - Rejected: Risk of cache conflicts during migration
- Single cache with composite keys - Rejected: Harder to invalidate selectively

### 4. Controller Versioning Pattern

**Task**: Identify best pattern for v2 controller implementation.

**Decision**: Create `ChainsV2Controller` in `src/modules/chains/routes/v2/` following the pattern from `SafesV2Controller`.

**Rationale**:

- Consistent with existing v2 patterns (`safes.v2.controller.ts`, `delegates.v2.controller.ts`)
- Separate file keeps v1 controller unchanged (FR-003)
- Clear separation of concerns

**Alternatives considered**:

- Add v2 methods to existing controller - Rejected: Violates single responsibility, harder to maintain
- Decorator-based versioning on same controller - Rejected: Less explicit, harder to navigate

### 5. Repository Layer Design

**Task**: Determine if v2 needs separate repository methods.

**Decision**: Add `getChainsV2()` and `getChainV2()` methods to existing `IChainsRepository` interface and `ChainsRepository` implementation.

**Rationale**:

- Reuses existing dependency injection structure
- Clear method names distinguish v1/v2 behavior
- Single repository maintains domain logic cohesion

**Alternatives considered**:

- Separate `IChainsRepositoryV2` interface - Rejected: Overkill for 2 methods
- Generic method with version parameter - Rejected: Less type-safe, harder to maintain

### 6. Config API Service Extension

**Task**: Design IConfigApi interface extension for v2 endpoints.

**Decision**: Add `getChainsV2(serviceKey, args)` and `getChainV2(serviceKey, chainId)` methods to `IConfigApi` interface and `ConfigApi` service.

**Rationale**:

- Maintains existing abstraction layer
- Allows mocking in tests
- Clear separation between v1 and v2 external API calls

**Alternatives considered**:

- Modify existing methods to optionally use v2 - Rejected: Violates FR-003a (internal components stay on v1)

### 7. Error Handling Strategy

**Task**: Define error handling for Config Service v2 failures.

**Decision**: Use existing `HttpErrorFactory` to propagate errors. No fallback to v1.

**Rationale**:

- Follows existing error handling patterns
- v2 and v1 are independent endpoints with different semantics
- Fallback would mask configuration issues

**Alternatives considered**:

- Fallback to v1 on v2 failure - Rejected: Would defeat purpose of service-scoped features
- Custom error types for v2 - Rejected: Unnecessary complexity, existing errors sufficient

## Summary

All research tasks resolved. Key decisions:

1. New v2 methods in existing interfaces (not separate interfaces)
2. Service key via environment variable with "frontend" default
3. Separate cache namespace for v2 endpoints
4. Follow existing v2 controller patterns
5. No fallback behavior - v2 failures propagate as errors
