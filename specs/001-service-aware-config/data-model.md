# Data Model: Service-Aware Feature Configuration Integration

**Feature Branch**: `001-service-aware-config`  
**Date**: 2026-02-04

## Overview

This feature does not introduce new persistent entities. It extends existing interfaces and adds caching with service-key awareness.

## Existing Entities (Unchanged)

### Chain Entity

The existing `Chain` domain entity remains unchanged. v2 endpoints return the same schema, just with service-scoped feature visibility.

**Location**: `src/modules/chains/domain/entities/chain.entity.ts`

```typescript
interface Chain {
  chainId: string;
  chainName: string;
  description: string;
  chainLogoUri: string | null;
  l2: boolean;
  isTestnet: boolean;
  shortName: string;
  rpcUri: RpcUri;
  safeAppsRpcUri: RpcUri;
  publicRpcUri: RpcUri;
  blockExplorerUriTemplate: BlockExplorerUriTemplate;
  nativeCurrency: NativeCurrency;
  transactionService: string;
  vpcTransactionService: string;
  theme: Theme;
  gasPrice: GasPrice[];
  ensRegistryAddress: string | null;
  disabledWallets: string[];
  features: string[]; // Service-scoped features from v2 API
  balancesProvider: BalancesProvider;
  contractAddresses: ContractAddresses;
  recommendedMasterCopyVersion: string | null;
}
```

### Page Entity

Standard pagination wrapper, unchanged.

**Location**: `src/domain/entities/page.entity.ts`

```typescript
interface Page<T> {
  count: number | null;
  next: string | null;
  previous: string | null;
  results: T[];
}
```

## New/Extended Interfaces

### IConfigApi Extension

**Location**: `src/domain/interfaces/config-api.interface.ts`

```typescript
interface IConfigApi {
  // Existing v1 methods (unchanged)
  getChains(args: {
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<Chain>>>;
  getChain(chainId: string): Promise<Raw<Chain>>;
  clearChain(chainId: string): Promise<void>;

  // NEW: v2 methods with service key
  getChainsV2(
    serviceKey: string,
    args: { limit?: number; offset?: number },
  ): Promise<Raw<Page<Chain>>>;
  getChainV2(serviceKey: string, chainId: string): Promise<Raw<Chain>>;
  clearChainV2(serviceKey: string, chainId: string): Promise<void>;
}
```

### IChainsRepository Extension

**Location**: `src/modules/chains/domain/chains.repository.interface.ts`

```typescript
interface IChainsRepository {
  // Existing v1 methods (unchanged)
  getChain(chainId: string): Promise<Chain>;
  getChains(limit?: number, offset?: number): Promise<Page<Chain>>;
  clearChain(chainId: string): Promise<void>;

  // NEW: v2 methods
  getChainV2(serviceKey: string, chainId: string): Promise<Chain>;
  getChainsV2(
    serviceKey: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Chain>>;
  clearChainV2(chainId: string, serviceKey: string): Promise<void>;
}
```

## Cache Key Structure

### v1 Cache Keys (Unchanged)

```
chains                      → List of all chains
{chainId}_chain             → Single chain by ID
```

### v2 Cache Keys (New)

```
chains_v2_{serviceKey}                    → List of chains for service
{chainId}_chain_v2_{serviceKey}           → Single chain for service
```

**Rationale**: Separate namespace prevents cache pollution between v1/v2 and between different service keys.

## Validation Rules

| Field        | Rule                                 | Source              |
| ------------ | ------------------------------------ | ------------------- |
| serviceKey   | Non-empty string                     | FR-004, FR-005      |
| chainId      | String, validated by existing schema | Existing            |
| limit/offset | Positive integers                    | Existing pagination |

## State Transitions

No state transitions - this feature is read-only data retrieval.

## Relationships

```
┌─────────────────────┐
│  ChainsV2Controller │
└─────────┬───────────┘
          │ uses
          ▼
┌─────────────────────┐
│   ChainsV2Service   │
└─────────┬───────────┘
          │ uses
          ▼
┌─────────────────────┐
│  IChainsRepository  │──► getChainsV2(), getChainV2()
└─────────┬───────────┘
          │ uses
          ▼
┌─────────────────────┐
│     IConfigApi      │──► getChainsV2(), getChainV2()
└─────────┬───────────┘
          │ calls
          ▼
┌─────────────────────┐
│ Config Service v2   │  (external)
│ /api/v2/chains/...  │
└─────────────────────┘
```
