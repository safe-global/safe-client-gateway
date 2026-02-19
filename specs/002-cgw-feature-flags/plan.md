# SPDX-License-Identifier: FSL-1.1-MIT
# Implementation Plan: CGW Feature Flag System

**Branch**: `002-cgw-feature-flags` | **Date**: 2026-02-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-cgw-feature-flags/spec.md`

## Summary

Implement a feature flag system for CGW that uses Config Service v2 endpoints with a dedicated CGW service key (default "cgw") to fetch chain configurations containing CGW-specific feature flags. The system provides an injectable NestJS service (FeatureFlagService) with a single chain-scoped function `isFeatureEnabled(chainId, featureKey)` that allows developers to check feature flag status anywhere in the application. Caching follows the same patterns as the existing frontend implementation to ensure performance and data isolation.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22.x  
**Primary Dependencies**: NestJS 10.x, Zod (validation), class-validator/class-transformer  
**Storage**: Redis (caching only - no persistent storage changes)  
**Testing**: Jest (unit: `*.spec.ts`, integration: `*.integration.spec.ts`)  
**Target Platform**: Linux server (Docker container)  
**Project Type**: NestJS monolith (backend API gateway)  
**Performance Goals**: Feature flag checks use cached data (<1ms p95), cache hit rate ≥80%  
**Constraints**: Must reuse existing v2 infrastructure from `001-service-aware-config`; no breaking changes to existing endpoints  
**Scale/Scope**: 1 new service, ~8-10 new/modified files, extends existing v2 chains infrastructure

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                   | Status         | Notes                                                                      |
| --------------------------- | -------------- | -------------------------------------------------------------------------- |
| I. Pre-Commit Quality Gates | ✅ Will comply | `yarn format`, `yarn lint --fix`, `yarn test` before each commit           |
| II. Testing Discipline      | ✅ Will comply | Unit tests for FeatureFlagService, integration tests for service injection |
| III. API Consistency        | ✅ N/A         | Internal service API only (no REST endpoints)                              |
| IV. Database Integrity      | ✅ N/A         | No database changes - caching only                                         |
| V. Simplicity & Focus       | ✅ Will comply | Reuses existing v2 infrastructure, minimal new code                        |

**Gate Status**: ✅ PASS - No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/002-cgw-feature-flags/
├── plan.md              # This file
├── research.md          # Phase 0 output - technical decisions
├── data-model.md        # Phase 1 output - entity definitions
├── quickstart.md         # Phase 1 output - developer setup guide
├── contracts/           # Phase 1 output - service interface definitions
│   └── feature-flag-service.yaml
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── config/
│   └── entities/
│       └── configuration.ts          # Add safeConfig.cgwServiceKey setting
├── datasources/
│   └── config-api/
│       └── config-api.service.ts     # Already has v2 methods (from 001)
└── modules/
    └── chains/
        ├── chains.module.ts          # Register FeatureFlagService
        ├── domain/
        │   ├── chains.repository.ts           # Already has v2 methods (from 001)
        │   └── chains.repository.interface.ts # Already has v2 interface (from 001)
        └── feature-flags/
            ├── feature-flag.service.ts         # NEW: FeatureFlagService
            ├── feature-flag.service.spec.ts    # NEW: Unit tests
            ├── feature-flag.service.interface.ts # NEW: Interface
            └── feature-flags.module.ts         # NEW: Module
```

**Structure Decision**: New `feature-flags/` subdirectory under `chains/` module since feature flags are chain-scoped. Reuses existing v2 infrastructure from `001-service-aware-config`. FeatureFlagService follows NestJS service patterns with dependency injection.

## Complexity Tracking

> No violations to justify - design reuses existing patterns and infrastructure.

## Phase 0: Research ✅ Complete

**Output**: `research.md` - All technical decisions documented

Key decisions:

- CGW service key configuration: `SAFE_CONFIG_CGW_KEY` env var, default "CGW"
- FeatureFlagService interface: Single chain-scoped `isFeatureEnabled(chainId, featureKey)` method
- Error handling: Fail-safe (return false) for missing/unavailable configs
- Caching: Reuse existing chain config cache, no additional caching layer

## Phase 1: Design & Contracts ✅ Complete

**Outputs**:

- `data-model.md` - IFeatureFlagService interface, configuration schema
- `contracts/feature-flag-service.yaml` - Service interface documentation
- `quickstart.md` - Developer usage guide

**Key Artifacts**:

- IFeatureFlagService interface with single `isFeatureEnabled(chainId, featureKey)` method
- Configuration extension: `safeConfig.cgwServiceKey` with `SAFE_CONFIG_CGW_KEY` env var
- Feature flag evaluation logic documented (chain-scoped only)

## Next Steps

Proceed to `/speckit.tasks` to generate implementation tasks.
