# Tasks: Service-Aware Feature Configuration Integration

**Input**: Design documents from `/specs/001-service-aware-config/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Create directory structure for v2 components

- [ ] T001 Create v2 routes directory at `src/modules/chains/routes/v2/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Configuration (FR-004, FR-005)

- [ ] T002 Add `safeConfig.serviceKey` configuration with `CONFIG_SERVICE_FRONTEND_KEY` env var (default "frontend") in `src/config/entities/configuration.ts`
- [ ] T003 [P] Add serviceKey to configuration schema in `src/config/entities/schemas/configuration.schema.ts`

### Interface Extensions

- [ ] T004 [P] Add `getChainsV2()`, `getChainV2()`, `clearChainV2()` method signatures to `src/domain/interfaces/config-api.interface.ts`
- [ ] T005 [P] Add `getChainsV2()`, `getChainV2()` method signatures to `src/modules/chains/domain/chains.repository.interface.ts`

### Cache Router

- [ ] T006 [P] Add `getChainsCacheKeyV2(serviceKey)` method to `src/datasources/cache/cache.router.ts`
- [ ] T007 [P] Add `getChainsCacheDirV2(serviceKey, args)` method to `src/datasources/cache/cache.router.ts`
- [ ] T008 [P] Add `getChainCacheKeyV2(serviceKey, chainId)` method to `src/datasources/cache/cache.router.ts`
- [ ] T009 [P] Add `getChainCacheDirV2(serviceKey, chainId)` method to `src/datasources/cache/cache.router.ts`

### Config API Service

- [ ] T010 Implement `getChainsV2(serviceKey, args)` method in `src/datasources/config-api/config-api.service.ts`
- [ ] T011 Implement `getChainV2(serviceKey, chainId)` method in `src/datasources/config-api/config-api.service.ts`
- [ ] T012 Implement `clearChainV2(serviceKey, chainId)` method in `src/datasources/config-api/config-api.service.ts`
- [ ] T013 Add unit tests for v2 methods in `src/datasources/config-api/config-api.service.spec.ts`

### Chains Repository

- [ ] T014 Implement `getChainsV2(limit, offset)` method in `src/modules/chains/domain/chains.repository.ts`
- [ ] T015 Implement `getChainV2(chainId)` method in `src/modules/chains/domain/chains.repository.ts`
- [ ] T016 Add unit tests for v2 methods in `src/modules/chains/domain/chains.repository.spec.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Retrieve Service-Scoped Chain List (Priority: P1) 🎯 MVP

**Goal**: New `GET /v2/chains` endpoint returns paginated list of chains with service-scoped features

**Independent Test**: `curl http://localhost:3000/v2/chains` returns chain list with service-appropriate configuration

### Implementation for User Story 1

- [ ] T017 [US1] Create `ChainsV2Service` class in `src/modules/chains/routes/v2/chains.v2.service.ts`
- [ ] T018 [US1] Implement `getChains(routeUrl, paginationData)` method in `ChainsV2Service`
- [ ] T019 [US1] Create `ChainsV2Controller` with `@Controller({ path: 'chains', version: '2' })` in `src/modules/chains/routes/v2/chains.v2.controller.ts`
- [ ] T020 [US1] Implement `GET /v2/chains` endpoint with pagination support in `ChainsV2Controller`
- [ ] T021 [US1] Add OpenAPI decorators (`@ApiTags`, `@ApiOperation`, `@ApiOkResponse`, `@ApiQuery`) to chains list endpoint
- [ ] T022 [US1] Register `ChainsV2Controller` and `ChainsV2Service` in `src/modules/chains/chains.module.ts`
- [ ] T023 [US1] Add unit tests for `ChainsV2Service.getChains()` in `src/modules/chains/routes/v2/chains.v2.service.spec.ts`
- [ ] T024 [US1] Add integration tests for `GET /v2/chains` in `src/modules/chains/routes/v2/chains.v2.controller.integration.spec.ts`

**Checkpoint**: User Story 1 complete - `GET /v2/chains` is functional and tested

---

## Phase 4: User Story 2 - Retrieve Service-Scoped Single Chain (Priority: P1)

**Goal**: New `GET /v2/chains/:chainId` endpoint returns single chain with service-scoped features

**Independent Test**: `curl http://localhost:3000/v2/chains/1` returns chain 1 configuration with service-appropriate features

### Implementation for User Story 2

- [ ] T025 [US2] Implement `getChain(chainId)` method in `ChainsV2Service` in `src/modules/chains/routes/v2/chains.v2.service.ts`
- [ ] T026 [US2] Implement `GET /v2/chains/:chainId` endpoint in `ChainsV2Controller` in `src/modules/chains/routes/v2/chains.v2.controller.ts`
- [ ] T027 [US2] Add OpenAPI decorators (`@ApiParam`, `@ApiOperation`, `@ApiOkResponse`) to single chain endpoint
- [ ] T028 [US2] Add unit tests for `ChainsV2Service.getChain()` in `src/modules/chains/routes/v2/chains.v2.service.spec.ts`
- [ ] T029 [US2] Add integration tests for `GET /v2/chains/:chainId` (success and 404 cases) in `src/modules/chains/routes/v2/chains.v2.controller.integration.spec.ts`

**Checkpoint**: User Story 2 complete - `GET /v2/chains/:chainId` is functional and tested

---

## Phase 5: User Story 3 - Configurable Service Key (Priority: P2)

**Goal**: Operators can configure the service key via `CONFIG_SERVICE_FRONTEND_KEY` environment variable

**Independent Test**: Set `CONFIG_SERVICE_FRONTEND_KEY=custom` and verify v2 endpoints call Config Service with "custom" service key

### Implementation for User Story 3

- [ ] T030 [US3] Add configuration validation test for `safeConfig.serviceKey` in `src/config/configuration.validator.spec.ts`
- [ ] T031 [US3] Update `.env.sample` with `CONFIG_SERVICE_FRONTEND_KEY` documentation
- [ ] T032 [US3] Add integration test verifying service key is used in Config Service v2 calls in `src/modules/chains/routes/v2/chains.v2.controller.integration.spec.ts`

**Checkpoint**: User Story 3 complete - service key is configurable and validated

---

## Phase 6: User Story 4 - Cache Invalidation for Service-Scoped Data (Priority: P2)

**Goal**: Cache invalidation works correctly for v2 endpoints with service-key-aware cache keys

**Independent Test**: Trigger cache invalidation hook and verify v2 cached data is cleared

### Implementation for User Story 4

- [ ] T033 [US4] Implement `clearChainsV2()` method in `ChainsRepository` in `src/modules/chains/domain/chains.repository.ts`
- [ ] T034 [US4] Add cache invalidation handling for v2 chains in hooks controller (if needed) in `src/modules/hooks/routes/hooks.controller.ts`
- [ ] T035 [US4] Add unit tests for v2 cache invalidation in `src/modules/chains/domain/chains.repository.spec.ts`
- [ ] T036 [US4] Add integration test for cache invalidation via hooks in `src/modules/hooks/routes/hooks-cache.integration.spec.ts`

**Checkpoint**: User Story 4 complete - cache invalidation works for v2 endpoints

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final quality checks and documentation

- [ ] T037 [P] Run `yarn format` to ensure code formatting
- [ ] T038 [P] Run `yarn lint --fix` to fix linting issues
- [ ] T039 Run `yarn test` to verify all unit tests pass
- [ ] T040 Run `yarn test:integration` to verify all integration tests pass
- [ ] T041 [P] Verify v1 endpoints still work unchanged (regression test)
- [ ] T042 [P] Update Swagger documentation if needed
- [ ] T043 Validate implementation against `specs/001-service-aware-config/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **User Story 2 (Phase 4)**: Depends on Foundational phase; can run parallel to US1
- **User Story 3 (Phase 5)**: Depends on Foundational phase; mostly validation of existing config
- **User Story 4 (Phase 6)**: Depends on US1/US2 cache structure
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

| Story | Dependencies | Can Parallel With |
| ----- | ------------ | ----------------- |
| US1 (P1) | Phase 2 complete | US2, US3 |
| US2 (P1) | Phase 2 complete | US1, US3 |
| US3 (P2) | Phase 2 complete | US1, US2 |
| US4 (P2) | US1/US2 cache patterns | - |

### Within Each User Story

- Service implementation before controller
- Controller implementation before tests
- Unit tests before integration tests

### Parallel Opportunities

**Phase 2 (Foundational)**:
```
Parallel Group A (Interfaces):
  - T004: IConfigApi interface
  - T005: IChainsRepository interface

Parallel Group B (Cache Router):
  - T006, T007, T008, T009: Cache key methods

Then Sequential:
  - T010-T012: ConfigApi implementation
  - T014-T15: Repository implementation
```

**Phase 3-5 (User Stories 1-3)**:
```
After Phase 2 completes, US1/US2/US3 can start in parallel:
  - Developer A: US1 (T017-T024)
  - Developer B: US2 (T025-T029)
  - Developer C: US3 (T030-T032)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1 (`GET /v2/chains`)
4. **STOP and VALIDATE**: Test endpoint independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → `GET /v2/chains` works → Deploy (MVP!)
3. Add User Story 2 → `GET /v2/chains/:chainId` works → Deploy
4. Add User Story 3 → Service key configurable → Deploy
5. Add User Story 4 → Cache invalidation works → Deploy
6. Polish → Production ready

### Single Developer Strategy

Execute in order: T001 → T002 → ... → T043

Commit checkpoints:
- After Phase 2 (foundation complete)
- After each user story phase
- After Polish phase

---

## Notes

- **[P]** tasks can run in parallel (different files, no dependencies)
- **[Story]** label maps task to specific user story
- Existing v1 endpoints MUST remain unchanged (FR-003)
- Internal components continue using v1 (FR-003a)
- Response format must match existing Chain entity (FR-006)
- Run quality gates (`yarn format`, `yarn lint --fix`, `yarn test`) before each commit
