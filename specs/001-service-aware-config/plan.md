# Implementation Plan: Service-Aware Feature Configuration Integration

**Branch**: `001-service-aware-config` | **Date**: 2026-02-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-service-aware-config/spec.md`

## Summary

Add new v2 CGW chain endpoints (`GET /v2/chains?serviceKey=` and `GET /v2/chains/:chainId?serviceKey=`) that fetch service-scoped configuration from the Config Service v2 API. The existing v1 endpoints remain unchanged. Service key is passed as a query parameter to avoid route conflicts with other v2 endpoints (e.g. delegates).

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22.x  
**Primary Dependencies**: NestJS 10.x, Zod (validation), class-validator/class-transformer  
**Storage**: Redis (caching only - no persistent storage changes)  
**Testing**: Jest (unit: `*.spec.ts`, integration: `*.integration.spec.ts`)  
**Target Platform**: Linux server (Docker container)  
**Project Type**: NestJS monolith (backend API gateway)  
**Performance Goals**: Match existing v1 endpoint latency (<100ms p95 cached, <500ms p95 uncached)  
**Constraints**: No breaking changes to v1 endpoints; response format must match existing Chain entity schema  
**Scale/Scope**: 2 new endpoints, ~10 new/modified files

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                   | Status         | Notes                                                                    |
| --------------------------- | -------------- | ------------------------------------------------------------------------ |
| I. Pre-Commit Quality Gates | ✅ Will comply | `yarn format`, `yarn lint --fix`, `yarn test` before each commit         |
| II. Testing Discipline      | ✅ Will comply | Unit tests for services/controllers, integration tests for API endpoints |
| III. API Consistency        | ✅ Will comply | OpenAPI decorators, Zod schemas, versioned endpoints (v2)                |
| IV. Database Integrity      | ✅ N/A         | No database changes - caching only                                       |
| V. Simplicity & Focus       | ✅ Will comply | Minimal changes: 2 endpoints, reuses existing patterns                   |

**Gate Status**: ✅ PASS - No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-service-aware-config/
├── plan.md              # This file
├── research.md          # Phase 0 output - technical decisions
├── data-model.md        # Phase 1 output - entity definitions
├── quickstart.md        # Phase 1 output - developer setup guide
├── contracts/           # Phase 1 output - OpenAPI specs
│   └── chains-v2.yaml
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── config/
│   └── entities/
│       └── configuration.ts          # Add safeConfig.serviceKey setting
├── datasources/
│   ├── config-api/
│   │   ├── config-api.service.ts     # Add getChainsV2, getChainV2 methods
│   │   └── config-api.service.spec.ts
│   └── cache/
│       └── cache.router.ts           # Add v2 cache key methods
└── modules/
    └── chains/
        ├── chains.module.ts          # Register v2 controller
        ├── domain/
        │   ├── chains.repository.ts           # Add v2 methods
        │   └── chains.repository.interface.ts # Add v2 interface
        └── routes/
            └── v2/
                ├── chains.v2.controller.ts      # NEW: v2 controller
                ├── chains.v2.controller.integration.spec.ts  # NEW
                ├── chains.v2.service.ts         # NEW: v2 service
                └── chains.v2.service.spec.ts    # NEW
```

**Structure Decision**: Follow existing v2 controller pattern (see `src/modules/safe/routes/v2/`). New v2 components in dedicated `v2/` subdirectory. Reuse existing entity definitions (`Chain`, `ChainPage`).

## Complexity Tracking

> No violations to justify - design follows existing patterns.
