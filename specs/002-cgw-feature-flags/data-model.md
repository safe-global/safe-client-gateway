# Data Model: CGW Feature Flag System

**Feature Branch**: `002-cgw-feature-flags`  
**Date**: 2026-02-09

## Overview

This feature does not introduce new persistent entities. It extends existing interfaces and adds a new service for feature flag evaluation.

## Existing Entities (Unchanged)

### Chain Entity

The existing `Chain` domain entity remains unchanged. Feature flags are stored in the `features` array property.

**Location**: `src/modules/chains/domain/entities/chain.entity.ts`

```typescript
interface Chain {
  chainId: string;
  chainName: string;
  // ... other fields ...
  features: string[]; // CGW-scoped feature flags from v2 API
  // ... other fields ...
}
```

## New/Extended Interfaces

### IFeatureFlagService

**Location**: `src/modules/chains/feature-flags/feature-flag.service.interface.ts`

```typescript
interface IFeatureFlagService {
  /**
   * Checks if a feature flag is enabled for a specific chain.
   * @param chainId - The chain identifier
   * @param featureKey - The feature flag key from Config Service
   * @returns true if feature is enabled, false if disabled or missing
   */
  isFeatureEnabled(chainId: string, featureKey: string): Promise<boolean>;
}
```

### Configuration Schema Extension

**Location**: `src/config/entities/configuration.ts`

```typescript
safeConfig: {
  baseUri: string;
  chains: {
    maxSequentialPages: number;
  }
  safes: {
    maxSequentialPages: number;
  }
  cgwServiceKey: string; // NEW: CGW service key (default "CGW")
}
```

**Environment Variable**: `SAFE_CONFIG_CGW_KEY`  
**Default Value**: `"CGW"`

## Validation Rules

| Field         | Rule             | Source         |
| ------------- | ---------------- | -------------- |
| cgwServiceKey | Non-empty string | FR-004         |
| chainId       | Non-empty string | FR-008         |
| featureKey    | Non-empty string | FR-008, FR-011 |

## Feature Flag Evaluation Logic

### Chain-Scoped Check

1. Fetch chain configuration using `IChainsRepository.getChainV2(chainId)` with CGW service key
2. Check if `featureKey` exists in chain's `features` array
3. Return `true` if found, `false` otherwise
4. If chain config unavailable, return `false` and log warning

## Cache Key Structure

Feature flag checks use existing v2 cache keys (from `001-service-aware-config`):

```
chains_v2_cgw                    → List of chains for CGW service
{chainId}_chain_v2_cgw          → Single chain for CGW service
```

**Rationale**: Feature flags are part of chain configurations, so they benefit from the same caching strategy. No separate feature flag cache needed.
