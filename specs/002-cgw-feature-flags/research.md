# SPDX-License-Identifier: FSL-1.1-MIT

# Research: CGW Feature Flag System

**Feature Branch**: `002-cgw-feature-flags`  
**Date**: 2026-02-09

## Research Tasks

### 1. CGW Service Key Configuration Pattern

**Task**: Determine how to configure the CGW service key separately from the frontend service key.

**Decision**: Add `safeConfig.cgwServiceKey` configuration with environment variable `SAFE_CONFIG_CGW_KEY`, defaulting to `"CGW"`.

**Rationale**:

- Follows existing configuration patterns in `configuration.ts` (similar to `safeConfig.frontendServiceKey` for frontend)
- Environment variable allows runtime configuration without code changes
- Default "cgw" per spec requirements (FR-004)
- Separate from frontend service key to maintain independence

**Alternatives considered**:

- Reuse `safeConfig.frontendServiceKey` with different env var - Rejected: Frontend already uses this, would cause conflicts
- Feature flag approach - Rejected: Service key is a required parameter, not optional behavior
- Per-request header - Rejected: Spec requires CGW-level configuration, not per-request

### 2. Feature Flag Service Architecture

**Task**: Design the FeatureFlagService interface and implementation pattern.

**Decision**: Create `IFeatureFlagService` interface with single method:

- `isFeatureEnabled(chainId: string, featureKey: string): Promise<boolean>` - Chain-scoped check

**Rationale**:

- Follows NestJS dependency injection patterns (injectable service)
- Async methods allow for potential future cache misses requiring chain config fetch
- Simple, focused API with single responsibility
- Returns boolean (false for missing flags) per FR-011

**Alternatives considered**:

- Synchronous methods - Rejected: May need to fetch chain configs if not cached, requires async
- Global check method - Rejected: Not needed per user requirements, simplifies API
- Return null/undefined for missing flags - Rejected: Spec requires false (FR-011)

### 3. Feature Flag Service Dependencies

**Task**: Determine dependencies for FeatureFlagService.

**Decision**: FeatureFlagService depends on:

- `IChainsRepository` - To fetch chain configurations (uses v2 methods)
- `IConfigurationService` - To get CGW service key configuration
- `ILoggingService` - For error logging and debugging

**Rationale**:

- Reuses existing repository pattern (IChainsRepository already has v2 methods)
- Configuration service provides CGW service key
- Logging for observability and debugging

**Alternatives considered**:

- Direct dependency on ConfigApi - Rejected: Violates repository pattern, bypasses domain layer
- Direct cache access - Rejected: FeatureFlagService should use repository abstraction

### 4. Error Handling Strategy

**Task**: Determine behavior when chain configurations are unavailable.

**Decision**:

- For chain-scoped checks: Return false if chain config unavailable (fail-safe)
- Log warnings for Config Service errors but don't throw exceptions

**Rationale**:

- Fail-safe approach: Missing flags/default to disabled prevents accidental feature activation
- Logging provides observability without breaking application flow
- Aligns with FR-011 (return false for missing flags)

**Alternatives considered**:

- Throw exceptions - Rejected: Would break application flow, too aggressive
- Return null/undefined - Rejected: Spec requires boolean (FR-011)

### 5. Cache Strategy for Feature Flag Checks

**Task**: Determine caching approach for feature flag lookups.

**Decision**: FeatureFlagService uses cached chain configurations via IChainsRepository. No additional caching layer needed.

**Rationale**:

- Chain configurations are already cached (from 001-service-aware-config)
- Feature flag checks are simple array lookups on cached data
- Additional caching would add complexity without significant benefit
- Cache invalidation handled at chain config level

**Alternatives considered**:

- Feature flag-specific cache - Rejected: Unnecessary complexity, chain config cache sufficient
- No caching - Rejected: Would require fetching chain configs on every check, poor performance
