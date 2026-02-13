# Feature Specification: CGW Feature Flag System

**Feature Branch**: `002-cgw-feature-flags`  
**Created**: 2026-02-09  
**Status**: Draft  
**Input**: User description: "I'd like to implement a new feature flag system for CGW using the new v2 chains endopints. It should use a separate service key (default = \"cgw\") for fetching the chain configs with the feature flags. It should also use caching, like the existing implementation for the frontend."

## Clarifications

### Session 2026-02-09

- Q: How should the feature flag evaluation API be accessed throughout the application? → A: Injectable NestJS service - a FeatureFlagService that can be injected into any component (services, controllers, guards, etc.) following NestJS dependency injection patterns.
- Q: What should happen when a feature flag key doesn't exist in a chain's configuration? → A: Return false - when a feature flag key doesn't exist in chain config, return false (treat as feature disabled) rather than throwing an error.
- Q: Should the feature flag API support global checks or only chain-scoped checks? → A: Only chain-scoped - single function `isFeatureEnabled(chainId, featureKey)` for chain-scoped feature flag checks.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - CGW Fetches Chain Configurations with CGW-Scoped Feature Flags (Priority: P1)

CGW needs to retrieve chain configurations with feature flags specifically scoped to the "cgw" service. This allows CGW to have its own feature flags that are independent from the frontend service, enabling service-specific feature control. CGW fetches these configurations using the Config Service v2 endpoints with a dedicated service key (default "cgw"), and the data is cached to optimize performance and reduce external API calls.

**Why this priority**: Core functionality - without this capability, CGW cannot access its own service-scoped feature flags from chain configurations. All downstream feature flag usage depends on this foundation.

**Independent Test**: Can be fully tested by verifying CGW fetches chain configurations from Config Service v2 endpoints using the "cgw" service key and that the retrieved data includes CGW-specific feature flags.

**Acceptance Scenarios**:

1. **Given** CGW is configured with a CGW service key (default "cgw"), **When** CGW needs to access chain configurations with feature flags, **Then** CGW fetches data from Config Service v2 endpoints (`GET /api/v2/chains/cgw/` and `GET /api/v2/chains/cgw/{chain_id}/`) using the configured service key.

2. **Given** CGW has fetched chain configurations, **When** CGW needs to access the same chain configuration again, **Then** CGW retrieves the data from cache instead of making a new API call to Config Service.

3. **Given** CGW has cached chain configuration data, **When** the cache expires or is invalidated, **Then** CGW fetches fresh data from Config Service v2 endpoints.

---

### User Story 2 - Configurable CGW Service Key (Priority: P2)

Operators can configure the service key used by CGW for fetching its own chain configurations via an environment variable. This allows flexibility for different deployment environments or testing scenarios where a different service key might be needed.

**Why this priority**: Operational flexibility - while the default "cgw" is appropriate for most cases, the ability to override it enables environment-specific configurations and testing.

**Independent Test**: Can be tested by setting a custom environment variable and verifying CGW uses that service key when fetching chain configurations from Config Service v2 endpoints.

**Acceptance Scenarios**:

1. **Given** no CGW service key environment variable is set, **When** CGW initializes, **Then** CGW uses the default service key "cgw" for fetching chain configurations.

2. **Given** the CGW service key environment variable is set to a custom value (e.g., "cgw-staging"), **When** CGW fetches chain configurations, **Then** CGW uses the custom service key in Config Service v2 endpoint calls.

---

### User Story 3 - Cache Management for CGW Chain Configurations (Priority: P2)

CGW caches chain configurations fetched from Config Service v2 endpoints to improve performance and reduce load on the Config Service. The cache is isolated from other service caches (e.g., frontend) to prevent cross-service data pollution. Cache invalidation mechanisms ensure data freshness when chain configurations are updated.

**Why this priority**: Performance and data integrity - caching reduces latency and external API load, while cache isolation ensures CGW doesn't accidentally use frontend-scoped feature flags.

**Independent Test**: Can be tested by verifying cache keys include the service key, cache hits reduce API calls, and cache invalidation properly clears CGW-specific cached data.

**Acceptance Scenarios**:

1. **Given** CGW has cached chain configuration data for service key "cgw", **When** a cache invalidation event is received for a specific chain, **Then** only the cached data for that chain and service key "cgw" is cleared, leaving other service caches (e.g., "frontend") unaffected.

2. **Given** CGW cache keys include the service key, **When** CGW stores or retrieves cached chain configurations, **Then** cache keys are structured to prevent conflicts with other service caches (e.g., `chains_v2_cgw` vs `chains_v2_frontend`).

---

### User Story 4 - Feature Flag Evaluation API (Priority: P1)

Developers need an easy way to check whether a feature flag is enabled for a specific chain anywhere in the application codebase. This enables conditional logic based on feature flags stored in chain configurations, allowing features to be controlled per-chain without code changes. The API provides a single chain-scoped function `isFeatureEnabled(chainId, featureKey)`.

**Why this priority**: Core functionality - without this capability, CGW cannot actually use the feature flags it fetches. This is the primary value delivery mechanism for the feature flag system.

**Independent Test**: Can be fully tested by injecting FeatureFlagService into a component and verifying it correctly returns feature flag status for chain-specific checks.

**Acceptance Scenarios**:

1. **Given** a FeatureFlagService is injected into a component, **When** checking if a feature flag is enabled for a specific chain using `isFeatureEnabled(chainId, featureKey)`, **Then** the service returns true if the feature flag key exists in that chain's configuration and is enabled, false if the key doesn't exist or is not enabled.

2. **Given** a FeatureFlagService is checking a feature flag, **When** the feature flag key doesn't exist in the chain's configuration, **Then** the service returns false (treating missing flags as disabled) without throwing an error.

3. **Given** chain configurations are cached, **When** checking feature flag status, **Then** the service uses cached data without making additional Config Service API calls.

---

### Edge Cases

- What happens when the Config Service v2 endpoints are unavailable or return errors?
- How does CGW handle invalid or unrecognized service keys in Config Service responses?
- What happens when the CGW service key configuration is missing or empty (fallback to default "cgw")?
- How does CGW cache work when both CGW and frontend service keys are used simultaneously (separate cache namespaces)?
- What happens when a chain configuration update occurs while CGW is processing a request using cached data?
- How does CGW handle partial cache failures (some chains cached, others not)?
- What happens when checking a feature flag for a chain that hasn't been fetched/cached yet?
- How does the service handle Config Service errors when fetching chain configurations for feature flag checks?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: CGW MUST fetch chain configurations from Config Service v2 endpoints (`GET /api/v2/chains/{cgw_service_key}/` and `GET /api/v2/chains/{cgw_service_key}/{chain_id}/`) using a dedicated CGW service key.

- **FR-002**: CGW MUST use a separate service key (default "cgw") for fetching its own chain configurations, distinct from the service key used for frontend endpoints.

- **FR-003**: CGW MUST cache chain configurations fetched from Config Service v2 endpoints using cache keys that include the CGW service key to prevent cross-service cache pollution.

- **FR-004**: CGW MUST allow configuration of the CGW service key via an environment variable, defaulting to "cgw" if not specified.

- **FR-005**: CGW cache for chain configurations MUST be isolated from other service caches (e.g., frontend service cache) through distinct cache key namespaces.

- **FR-006**: CGW MUST support cache invalidation for CGW-specific chain configuration caches without affecting other service caches.

- **FR-007**: CGW MUST use the same caching mechanism and patterns as the existing frontend implementation for consistency and maintainability.

- **FR-008**: CGW MUST provide a feature flag evaluation API with a single chain-scoped function `isFeatureEnabled(chainId, featureKey)` that checks whether a feature flag (identified by key from Config Service) is enabled for a specific chain.

- **FR-009**: CGW feature flag evaluation API MUST be accessible from anywhere in the application codebase, providing an easy way to determine feature flag status.

- **FR-010**: CGW feature flag evaluation API MUST be implemented as an injectable NestJS service (FeatureFlagService) that can be injected into any component (services, controllers, guards, interceptors, etc.) following NestJS dependency injection patterns.

- **FR-011**: When a feature flag key doesn't exist in a chain's configuration, the feature flag evaluation API MUST return false (treat as feature disabled) rather than throwing an error or returning null/undefined.

### Key Entities _(include if feature involves data)_

- **CGW Chain Configuration**: Chain configuration data fetched from Config Service v2 endpoints using the CGW service key, containing CGW-specific feature flags and settings. Key attributes include chain identifier, feature flags scoped to CGW service, and configuration metadata.

- **CGW Service Key**: Identifier used to scope chain configurations to the CGW service. Defaults to "cgw" but can be configured via environment variable. Used in Config Service v2 endpoint URLs and cache key generation.

- **CGW Cache**: Cached chain configuration data specific to the CGW service key. Isolated from other service caches through service key inclusion in cache keys.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: CGW can fetch chain configurations with CGW-scoped feature flags from Config Service v2 endpoints using the configured service key (default "cgw") within 2 seconds under normal load conditions.

- **SC-002**: CGW cache hit rate for chain configurations is at least 80% during normal operation, reducing Config Service API calls.

- **SC-003**: CGW cache keys are properly isolated from frontend service cache keys, with zero instances of cross-service cache pollution observed in testing.

- **SC-004**: CGW service key can be configured via environment variable, and CGW successfully uses the configured value in Config Service v2 endpoint calls.

- **SC-005**: Cache invalidation for CGW chain configurations successfully clears only CGW-specific cached data without affecting other service caches.

- **SC-006**: CGW feature flag system operates independently from the frontend feature flag system, allowing separate feature flag management for each service.

- **SC-007**: Developers can check feature flag status from anywhere in the application using the `isFeatureEnabled(chainId, featureKey)` function.

## Assumptions

- Config Service v2 endpoints are available and support the "cgw" service key.
- Chain configuration response format from Config Service v2 endpoints is compatible with existing CGW chain entity schema.
- Existing caching infrastructure (CacheFirstDataSource, CacheRouter) can be extended to support CGW-specific cache keys.
- CGW service key "cgw" exists in the Config Service configuration.
- Cache expiration times and invalidation mechanisms follow the same patterns as the frontend implementation.
- CGW feature flags are stored within chain configuration objects returned by Config Service v2 endpoints.

## Dependencies

- Config Service v2 API endpoints must be available and operational.
- Existing v2 chains endpoint infrastructure from feature `001-service-aware-config` (ConfigApi.getChainsV2, ConfigApi.getChainV2, CacheRouter methods).
- Caching infrastructure (CacheFirstDataSource, CacheService, CacheRouter) must support service-key-scoped cache keys.

## Out of Scope

- Modifying existing v1 CGW chains endpoints (they remain unchanged).
- Modifying frontend service key configuration or frontend v2 endpoints.
- Migrating existing environment variable-based feature flags to the new system (this is a separate concern).
- Modifying Config Service API or adding new endpoints.
