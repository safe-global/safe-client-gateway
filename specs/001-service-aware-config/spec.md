# Feature Specification: Service-Aware Feature Configuration Integration

**Feature Branch**: `001-service-aware-config`  
**Created**: 2026-02-04  
**Status**: Draft  
**Input**: User description: "the config service api was updated by a service-aware feature configuration, allowing features to be scoped to specific services (e.g., CGW, frontend) and controlled at either a global or per-chain level. New v2 endpoints: `GET /api/v2/chains/{service_key}/` and `GET /api/v2/chains/{service_key}/{chain_id}/`. Integrate these new endpoints for existing implementation. Currently the frontend fetches the info, so with the new endpoints, the existing implementation needs to pass the frontend service key."

## Clarifications

### Session 2026-02-04

- Q: Should we modify existing v1 CGW endpoints or add new v2 CGW endpoints? → A: Add new v2 CGW endpoints; existing v1 endpoints remain unchanged.
- Q: Should internal components also switch to Config Service v2? → A: No; only new v2 CGW endpoints use Config Service v2; internal components continue using v1.
- Q: Which chain endpoints should have v2 versions? → A: Only main chain endpoints: `GET /v2/chains` and `GET /v2/chains/:chainId`.
- Q: What is the long-term plan for v1 endpoints? → A: Decide later based on v2 adoption metrics; no immediate deprecation planned.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Retrieve Service-Scoped Chain List via New v2 CGW Endpoint (Priority: P1)

A new CGW v2 chains endpoint retrieves a list of all supported chains with configurations scoped specifically to the requesting service (e.g., "frontend"). This ensures that only features and settings relevant to that service are returned, reducing payload size and avoiding exposure of irrelevant configuration. The existing v1 CGW chains endpoint remains unchanged.

**Why this priority**: Core functionality - without this, no service-aware chain retrieval is possible. All downstream features depend on this capability.

**Independent Test**: Can be fully tested by making a request to the new v2 chains endpoint and verifying the response contains service-appropriate chain configurations.

**Acceptance Scenarios**:

1. **Given** a request to `/v2/chains?serviceKey=WALLET_WEB`, **When** the request is processed, **Then** the CGW fetches chain data from the Config Service v2 endpoint using that service key and returns the scoped chain list.

2. **Given** a request to the v2 chains endpoint, **When** the Config Service v2 endpoint is unavailable, **Then** the new v2 CGW endpoint handles the error gracefully and returns an appropriate error response.

3. **Given** a request is made to the new v2 chains endpoint, **Then** the response structure is compatible with the existing v1 chains endpoint format (same Chain entity schema).

4. **Given** a request is made to the existing v1 chains endpoint, **Then** it continues to work unchanged using the Config Service v1 endpoint.

---

### User Story 2 - Retrieve Service-Scoped Single Chain via New v2 CGW Endpoint (Priority: P1)

A new CGW v2 single-chain endpoint retrieves configuration for a specific chain with features scoped to the requesting service. This enables per-chain feature visibility control based on the service context. The existing v1 CGW chain endpoint remains unchanged.

**Why this priority**: Essential companion to User Story 1 - chain details are frequently requested and must also respect service scoping.

**Independent Test**: Can be fully tested by requesting a specific chain's configuration via the new v2 endpoint and verifying the service-scoped features are returned.

**Acceptance Scenarios**:

1. **Given** a request to `/v2/chains/1?serviceKey=WALLET_WEB`, **When** the request is processed, **Then** the CGW fetches that chain's data from Config Service `GET /api/v2/chains/{service_key}/{chain_id}/` and returns the scoped configuration.

2. **Given** a request is made to the new v2 chain endpoint for a non-existent chain, **Then** the CGW returns a 404 error.

3. **Given** chain data is cached for the v2 endpoint, **When** a request is made for the same chain via v2, **Then** the cached data is returned (respecting existing cache invalidation policies).

4. **Given** a request is made to the existing v1 chain endpoint, **Then** it continues to work unchanged using the Config Service v1 endpoint.

---

### User Story 3 - Service Key via Query (Priority: P2)

Clients pass the service key as a query parameter when requesting v2 chain data. This allows different clients to request different service-scoped configs from the same CGW instance without configuration, and avoids route conflicts with other v2 endpoints (e.g. delegates).

**Why this priority**: Enables per-request service scoping without deployment-level configuration.

**Independent Test**: Request `/v2/chains?serviceKey=WALLET_WEB` and verify Config Service is called with WALLET_WEB.

**Acceptance Scenarios**:

1. **Given** a request to `/v2/chains?serviceKey={serviceKey}`, **When** the request is processed, **Then** the CGW calls Config Service v2 with that service key.

2. **Given** a request to `/v2/chains/{chainId}?serviceKey={serviceKey}`, **When** the request is processed, **Then** the CGW calls Config Service v2 with that service key and chain ID.

3. **Given** different service keys in the query, **When** requests are made, **Then** each uses its own cache namespace (no cross-service pollution).

---

### User Story 4 - Cache Invalidation for Service-Scoped Data (Priority: P2)

When chain configurations are updated in the Config Service, the CGW's cached data must be invalidatable. The cache key structure should account for the service key to prevent cross-service cache pollution.

**Why this priority**: Ensures data freshness and correctness when using service-scoped endpoints.

**Independent Test**: Can be tested by triggering cache invalidation hooks and verifying cached service-scoped data is cleared.

**Acceptance Scenarios**:

1. **Given** chain data is cached for a specific service key, **When** a cache invalidation event is received for that chain, **Then** the cached data for that chain and service key is cleared.

2. **Given** chain data is cached, **When** retrieving chain data after cache expiration, **Then** fresh data is fetched from the Config Service v2 endpoint.

---

### Edge Cases

- What happens when the Config Service v2 endpoints are not available for new v2 CGW endpoints?
- How does the system handle an invalid or unrecognized service key in v2 requests?
- What happens when the service key query parameter is missing or empty (returns 422)?
- How does caching work with both v1 and v2 CGW endpoints coexisting (separate cache namespaces)?
- Can a consumer call v1 and v2 CGW endpoints interchangeably during transition period?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST expose `GET /v2/chains?serviceKey={service_key}` endpoint that fetches data from Config Service v2 `GET /api/v2/chains/{service_key}/` using the service key from the query parameter.

- **FR-002**: System MUST expose `GET /v2/chains/:chainId?serviceKey={service_key}` endpoint that fetches data from Config Service v2 `GET /api/v2/chains/{service_key}/{chain_id}/` using the service key from the query parameter.

- **FR-002a**: Other chain-related endpoints (`/about`, `/about/backbone`, `/about/master-copies`, `/about/indexing`) do NOT require v2 versions as they fetch data from Transaction Service, not Config Service.

- **FR-003**: System MUST preserve existing v1 CGW chains endpoints unchanged (continue using Config Service v1).

- **FR-003a**: Internal CGW components (e.g., TransactionApiManager, BlockchainApiManager) MUST continue using Config Service v1; only the new v2 CGW endpoints use Config Service v2.

- **FR-004**: System MUST require the service key as a query parameter; clients pass it explicitly per request.

- **FR-005**: (Obsolete) Service key is passed per request; no environment variable or default.

- **FR-006**: System MUST maintain response format compatibility between v1 and v2 CGW endpoints (same Chain entity schema).

- **FR-007**: System MUST include the service key in cache keys to prevent cross-service cache pollution for v2 endpoints.

- **FR-008**: System MUST support cache invalidation for service-scoped chain data via existing webhook mechanisms.

- **FR-009**: System MUST handle Config Service v2 endpoint errors gracefully and return appropriate error responses.

### Key Entities

- **Service Key**: A string identifier representing the consuming service (e.g., "frontend", "cgw"). Used to scope feature visibility.

- **Chain Configuration**: Chain-specific settings including features, RPC endpoints, and service URLs. Now scoped by service key.

- **Cache Entry**: Cached chain data that includes the service key as part of its key structure for proper isolation.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: New v2 CGW endpoints successfully fetch data from Config Service v2 endpoints.

- **SC-002**: Existing v1 CGW endpoints continue to function unchanged (no breaking changes for current consumers).

- **SC-003**: Response format is identical between v1 and v2 CGW endpoints (same Chain entity schema).

- **SC-004**: Cache hit rates for v2 endpoints are consistent with v1 endpoint baseline (within 5% variance).

- **SC-005**: Error responses from the Config Service v2 are properly propagated to callers with appropriate status codes.

- **SC-006**: Clients pass the service key per request; no deployment-level configuration required.

## Assumptions

- The Config Service v2 endpoints (`/api/v2/chains/{service_key}/` and `/api/v2/chains/{service_key}/{chain_id}/`) are already deployed and available.

- The response format from v2 endpoints is compatible with the existing Chain entity schema used in the CGW.

- The "frontend" service key is registered and valid in the Config Service.

- Existing cache invalidation webhooks from the Config Service will continue to work with the v2 endpoint structure.

- No authentication changes are required for v2 endpoints - they use the same access patterns as v1.

- v1 CGW endpoints remain fully supported; deprecation decision deferred to post-launch based on v2 adoption metrics.
