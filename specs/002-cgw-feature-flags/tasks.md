# SPDX-License-Identifier: FSL-1.1-MIT

# Tasks: CGW Feature Flag System

**Input**: Design documents from `/specs/002-cgw-feature-flags/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Tests are included per NestJS testing discipline (Constitution Principle II)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create feature-flags module structure

- [x] T001 Create feature-flags directory structure in `src/modules/chains/feature-flags/`
- [x] T002 [P] Create `src/modules/chains/feature-flags/feature-flags.module.ts` with basic NestJS module structure
- [x] T003 [P] Create `src/modules/chains/feature-flags/feature-flag.service.interface.ts` with IFeatureFlagService interface stub

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: CGW service key configuration - MUST be complete before feature flag service can use it

**⚠️ CRITICAL**: No feature flag service work can begin until CGW service key configuration is complete

- [x] T004 Add `safeConfig.cgwServiceKey` configuration property in `src/config/entities/configuration.ts` with default value "cgw"
- [x] T005 Add `SAFE_CONFIG_CGW_KEY` environment variable support in `src/config/entities/configuration.ts`
- [x] T006 Add validation schema for `cgwServiceKey` in `src/config/entities/schemas/configuration.schema.ts` (non-empty string)
- [x] T007 Add unit tests for CGW service key configuration in `src/config/entities/__tests__/configuration.spec.ts`
- [x] T008 Update `.env.sample` with `SAFE_CONFIG_CGW_KEY` documentation

**Checkpoint**: CGW service key configuration ready - feature flag service can now access it

---

## Phase 3: User Story 1 - CGW Fetches Chain Configurations with CGW-Scoped Feature Flags (Priority: P1) 🎯 MVP

**Goal**: CGW fetches chain configurations from Config Service v2 endpoints using CGW service key (default "cgw") with caching support

**Independent Test**: Verify CGW can fetch chain configurations from Config Service v2 endpoints using "cgw" service key and retrieve CGW-specific feature flags

### Tests for User Story 1

**Note**: These tests verify CGW internal chain config fetching (for feature flags), NOT the v2 endpoints which continue using frontend service key.

- [x] T009 [P] [US1] Add unit test for ChainsRepository.getChainV2ForCgw() (or getChainV2 with CGW service key) in `src/modules/chains/domain/chains.repository.spec.ts`
- [x] T010 [P] [US1] Add unit test for ChainsRepository.getChainsV2ForCgw() (or getChainsV2 with CGW service key) in `src/modules/chains/domain/chains.repository.spec.ts`
- [x] T011 [US1] Add unit test verifying existing v2 endpoints continue using frontend service key (regression test) in `src/modules/chains/routes/v2/chains.v2.controller.integration.spec.ts`

### Implementation for User Story 1

**Note**: Most infrastructure already exists from `001-service-aware-config`. This phase ensures CGW can fetch chain configs using CGW service key for internal feature flag usage.

**IMPORTANT**: The existing v2 CGW endpoints (`GET /v2/chains`, `GET /v2/chains/:chainId`) continue using the frontend service key (`safeConfig.frontendServiceKey`) - they are unchanged. Only internal CGW feature flag usage uses the CGW service key.

- [x] T012 [US1] Add CGW service key property (`cgwServiceKey`) to ChainsRepository constructor (inject from `safeConfig.cgwServiceKey`) in `src/modules/chains/domain/chains.repository.ts` (keep existing `serviceKey` property for frontend v2 endpoints)
- [x] T013 [US1] Add new method `getChainV2ForCgw(chainId: string)` to IChainsRepository interface that uses CGW service key in `src/modules/chains/domain/chains.repository.interface.ts`
- [x] T014 [US1] Implement ChainsRepository.getChainV2ForCgw() that calls ConfigApi.getChainV2() with CGW service key in `src/modules/chains/domain/chains.repository.ts`
- [x] T015 [US1] Add new method `getChainsV2ForCgw()` to IChainsRepository interface that uses CGW service key in `src/modules/chains/domain/chains.repository.interface.ts`
- [x] T016 [US1] Implement ChainsRepository.getChainsV2ForCgw() that calls ConfigApi.getChainsV2() with CGW service key in `src/modules/chains/domain/chains.repository.ts`
- [x] T017 [US1] Verify existing v2 endpoints (`GET /v2/chains`, `GET /v2/chains/:chainId`) continue using frontend service key (`this.serviceKey`) and are unaffected by CGW service key changes

**Checkpoint**: User Story 1 complete - CGW can fetch chain configs with CGW-scoped feature flags

---

## Phase 4: User Story 4 - Feature Flag Evaluation API (Priority: P1) 🎯 MVP

**Goal**: Implement FeatureFlagService with `isFeatureEnabled(chainId, featureKey)` method that can be injected anywhere in the application

**Independent Test**: Inject FeatureFlagService into a component and verify it correctly returns feature flag status for chain-specific checks

### Tests for User Story 4

- [x] T018 [P] [US4] Add unit test for FeatureFlagService.isFeatureEnabled() when feature flag exists in `src/modules/chains/feature-flags/feature-flag.service.spec.ts`
- [x] T019 [P] [US4] Add unit test for FeatureFlagService.isFeatureEnabled() when feature flag missing in `src/modules/chains/feature-flags/feature-flag.service.spec.ts`
- [x] T020 [P] [US4] Add unit test for FeatureFlagService.isFeatureEnabled() when chain config unavailable (Config Service errors, network issues) in `src/modules/chains/feature-flags/feature-flag.service.spec.ts`
- [x] T021 [P] [US4] Add unit test for FeatureFlagService.isFeatureEnabled() when chain hasn't been fetched/cached yet (should fetch on-demand via ChainsRepository.getChainV2ForCgw()) in `src/modules/chains/feature-flags/feature-flag.service.spec.ts`
- [x] T022 [US4] Add integration test for FeatureFlagService using real chain configs with CGW service key in `src/modules/chains/feature-flags/feature-flag.service.integration.spec.ts`

### Implementation for User Story 4

- [x] T023 [US4] Implement IFeatureFlagService interface in `src/modules/chains/feature-flags/feature-flag.service.interface.ts` with `isFeatureEnabled(chainId: string, featureKey: string): Promise<boolean>`
- [x] T024 [US4] Implement FeatureFlagService class in `src/modules/chains/feature-flags/feature-flag.service.ts` with constructor injecting IChainsRepository, IConfigurationService, and ILoggingService
- [x] T025 [US4] Implement FeatureFlagService.isFeatureEnabled() method that fetches chain config using ChainsRepository.getChainV2ForCgw() (uses CGW service key, separate from v2 endpoints) in `src/modules/chains/feature-flags/feature-flag.service.ts` (handles chains not yet fetched/cached by fetching on-demand via repository)
- [x] T026 [US4] Implement feature flag lookup logic checking if featureKey exists in chain.features array in `src/modules/chains/feature-flags/feature-flag.service.ts`
- [x] T027 [US4] Implement error handling returning false (with warning log) when chain config unavailable (Config Service errors, network issues, or chain doesn't exist) in `src/modules/chains/feature-flags/feature-flag.service.ts`
- [x] T028 [US4] Register FeatureFlagService in FeatureFlagsModule as provider in `src/modules/chains/feature-flags/feature-flags.module.ts`
- [x] T029 [US4] Export FeatureFlagsModule and IFeatureFlagService from FeatureFlagsModule in `src/modules/chains/feature-flags/feature-flags.module.ts`
- [x] T030 [US4] Import FeatureFlagsModule in ChainsModule in `src/modules/chains/chains.module.ts`

**Checkpoint**: User Story 4 complete - FeatureFlagService is functional and can be injected anywhere

---

## Phase 5: User Story 2 - Configurable CGW Service Key (Priority: P2)

**Goal**: Operators can configure CGW service key via environment variable, defaulting to "cgw"

**Independent Test**: Set custom environment variable and verify CGW uses that service key in Config Service v2 endpoint calls

### Tests for User Story 2

- [ ] T031 [P] [US2] Add integration test verifying default "cgw" service key is used for CGW internal feature flag fetching (not v2 endpoints) in `src/modules/chains/feature-flags/feature-flag.service.integration.spec.ts`
- [ ] T032 [US2] Add integration test verifying custom CGW service key from env var is used in FeatureFlagService calls (not v2 endpoints) in `src/modules/chains/feature-flags/feature-flag.service.integration.spec.ts`

### Implementation for User Story 2

**Note**: Most implementation done in Phase 2. This phase adds verification and edge case handling.

- [ ] T033 [US2] Verify ChainsRepository handles missing/empty CGW service key config (fallback to "cgw") for getChainV2ForCgw() methods in `src/modules/chains/domain/chains.repository.ts`
- [ ] T034 [US2] Add error handling for invalid CGW service key configuration in `src/modules/chains/domain/chains.repository.ts`

**Checkpoint**: User Story 2 complete - CGW service key is configurable via environment variable

---

## Phase 6: User Story 3 - Cache Management for CGW Chain Configurations (Priority: P2)

**Goal**: CGW cache for chain configurations is isolated from frontend cache, with proper cache invalidation

**Independent Test**: Verify cache keys include service key, cache hits reduce API calls, and cache invalidation clears only CGW-specific cached data

### Tests for User Story 3

- [ ] T035 [P] [US3] Add unit test verifying cache keys include CGW service key for CGW internal fetching in `src/datasources/config-api/config-api.service.spec.ts`
- [ ] T036 [P] [US3] Add unit test verifying cache invalidation only affects CGW cache (not frontend cache) in `src/datasources/config-api/config-api.service.spec.ts`
- [ ] T037 [US3] Add integration test verifying cache isolation between CGW and frontend service keys (v2 endpoints use frontend cache, FeatureFlagService uses CGW cache) in `src/modules/chains/feature-flags/feature-flag.service.integration.spec.ts`

### Implementation for User Story 3

**Note**: Cache infrastructure already exists from `001-service-aware-config`. This phase verifies CGW-specific cache isolation.

- [ ] T038 [US3] Verify CacheRouter.getChainCacheKeyV2() includes service key for cache isolation (frontend vs CGW) in `src/datasources/cache/cache.router.ts`
- [ ] T039 [US3] Verify CacheRouter.getChainsCacheKeyV2() includes service key for cache isolation (frontend vs CGW) in `src/datasources/cache/cache.router.ts`
- [ ] T040 [US3] Verify ConfigApi.clearChainV2() only clears cache for the specific service key (CGW cache invalidation doesn't affect frontend cache) in `src/datasources/config-api/config-api.service.ts`

**Checkpoint**: User Story 3 complete - Cache management verified and isolated

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, validation, and final integration

- [ ] T041 [P] Update quickstart.md with actual usage examples from implementation
- [ ] T042 [P] Add JSDoc comments to FeatureFlagService methods in `src/modules/chains/feature-flags/feature-flag.service.ts`
- [ ] T043 [P] Add JSDoc comments to IFeatureFlagService interface in `src/modules/chains/feature-flags/feature-flag.service.interface.ts`
- [ ] T044 [P] Add JSDoc comments to new ChainsRepository methods (getChainV2ForCgw, getChainsV2ForCgw) in `src/modules/chains/domain/chains.repository.ts`
- [ ] T045 Run `yarn format` and fix formatting issues
- [ ] T046 Run `yarn lint --fix` and fix remaining lint errors
- [ ] T047 Run `yarn test` and ensure all tests pass
- [ ] T048 Verify FeatureFlagService can be injected in example controller/guard/interceptor (manual validation)
- [ ] T049 Update README.md if needed with feature flag usage documentation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS User Stories 1 and 4
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) - Needs CGW service key config
- **User Story 4 (Phase 4)**: Depends on Foundational (Phase 2) and User Story 1 (Phase 3) - Needs CGW service key and chain config fetching
- **User Story 2 (Phase 5)**: Depends on Foundational (Phase 2) - Mostly verification of Phase 2 work
- **User Story 3 (Phase 6)**: Depends on Foundational (Phase 2) - Cache verification
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 4 (P1)**: Depends on Foundational (Phase 2) and User Story 1 (Phase 3) - Needs CGW service key config and chain fetching capability
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Mostly verification, independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Cache verification, independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Interface before implementation
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- Setup tasks T002 and T003 can run in parallel
- Foundational tests T007 can run in parallel with implementation tasks T004-T006
- User Story 1 tests T009-T010 can run in parallel
- User Story 4 tests T018-T021 can run in parallel
- User Story 2 tests T031 can run in parallel with implementation
- User Story 3 tests T035-T036 can run in parallel (note: T037 is integration test)
- Polish tasks T041-T044 can run in parallel
- User Stories 2 and 3 can be worked on in parallel after Foundational phase

---

## Parallel Example: User Story 4

```bash
# Launch all tests for User Story 4 together:
Task: "Add unit test for FeatureFlagService.isFeatureEnabled() when feature flag exists"
Task: "Add unit test for FeatureFlagService.isFeatureEnabled() when feature flag missing"
Task: "Add unit test for FeatureFlagService.isFeatureEnabled() when chain config unavailable"
Task: "Add unit test for FeatureFlagService.isFeatureEnabled() when chain hasn't been fetched/cached yet"

# After tests, launch interface and module setup:
Task: "Implement IFeatureFlagService interface"
Task: "Register FeatureFlagService in FeatureFlagsModule as provider"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 4)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (CGW fetches chain configs)
4. Complete Phase 4: User Story 4 (FeatureFlagService)
5. **STOP and VALIDATE**: Test FeatureFlagService independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Verify CGW can fetch chain configs
3. Add User Story 4 → Test independently → Deploy/Demo (MVP with FeatureFlagService!)
4. Add User Story 2 → Test independently → Deploy/Demo (Configurable service key)
5. Add User Story 3 → Test independently → Deploy/Demo (Cache verification)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (chain config fetching)
   - Developer B: User Story 4 (FeatureFlagService) - can start after US1
   - Developer C: User Story 2 (service key config verification)
   - Developer D: User Story 3 (cache verification)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- User Story 4 is the primary deliverable - FeatureFlagService implementation
- Most infrastructure (v2 endpoints, caching) already exists from `001-service-aware-config`
- Focus on CGW service key configuration and FeatureFlagService implementation
