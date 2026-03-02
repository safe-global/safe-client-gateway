# SPDX-License-Identifier: FSL-1.1-MIT

# Quickstart: CGW Feature Flag System

**Feature Branch**: `002-cgw-feature-flags`  
**Date**: 2026-02-09

## Overview

This guide shows how to use the FeatureFlagService to check feature flags anywhere in the CGW application.

## Prerequisites

- CGW running with Config Service v2 endpoints available
- CGW service key "CGW" configured in Config Service
- Chain configurations with feature flags defined

## Configuration

### Environment Variable

Set the CGW service key (optional, defaults to "CGW"):

```bash
export SAFE_CONFIG_CGW_KEY=CGW
```

### Module Registration

The `FeatureFlagsModule` must be imported in `ChainsModule`:

```typescript
// src/modules/chains/chains.module.ts
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';

@Module({
  imports: [
    // ... other imports
    FeatureFlagsModule,
  ],
  // ...
})
export class ChainsModule {}
```

## Usage Examples

### Basic Usage: Inject FeatureFlagService

```typescript
import { Injectable } from '@nestjs/common';
import { IFeatureFlagService } from '@/modules/chains/feature-flags/feature-flag.service.interface';

@Injectable()
export class MyService {
  constructor(private readonly featureFlagService: IFeatureFlagService) {}

  async doSomething(chainId: string) {
    // Check chain-specific feature flag
    const enabled = await this.featureFlagService.isFeatureEnabled(
      chainId,
      'new-transaction-ui',
    );

    if (enabled) {
      // Use new transaction UI
    } else {
      // Use old transaction UI
    }
  }
}
```

### Chain-Scoped Feature Check

```typescript
// In a controller, service, guard, or interceptor
const useNewApi = await this.featureFlagService.isFeatureEnabled(
  '1', // Ethereum mainnet
  'new-api-endpoint',
);

if (useNewApi) {
  // Call new API
} else {
  // Call old API
}
```

### Using in Guards

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { IFeatureFlagService } from '@/modules/chains/feature-flags/feature-flag.service.interface';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private readonly featureFlagService: IFeatureFlagService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const chainId = request.params.chainId;

    return await this.featureFlagService.isFeatureEnabled(
      chainId,
      'protected-endpoint',
    );
  }
}
```

### Using in Interceptors

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { IFeatureFlagService } from '@/modules/chains/feature-flags/feature-flag.service.interface';

@Injectable()
export class FeatureFlagInterceptor implements NestInterceptor {
  constructor(private readonly featureFlagService: IFeatureFlagService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const chainId = request.params.chainId;

    const enabled = await this.featureFlagService.isFeatureEnabled(
      chainId,
      'enhanced-logging',
    );

    if (enabled) {
      // Add enhanced logging
    }

    return next.handle();
  }
}
```

## Behavior Notes

### Missing Feature Flags

If a feature flag key doesn't exist in a chain's configuration, the service returns `false` (treats as disabled). This is a fail-safe approach:

```typescript
// Returns false if "nonexistent-feature" doesn't exist
const enabled = await this.featureFlagService.isFeatureEnabled(
  '1',
  'nonexistent-feature',
); // false
```

### Unavailable Chain Configurations

If a chain configuration is unavailable (Config Service error, network issue), the service returns `false` and logs a warning:

```typescript
// Returns false if chain config unavailable, logs warning
const enabled = await this.featureFlagService.isFeatureEnabled(
  '999', // Chain that doesn't exist or is unavailable
  'some-feature',
); // false (with warning logged)
```

### Caching

Feature flag checks use cached chain configurations. Cache invalidation follows the same patterns as the frontend implementation. No additional caching is needed at the feature flag level.

## Testing

### Unit Tests

```typescript
// feature-flag.service.spec.ts
describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let chainsRepository: jest.Mocked<IChainsRepository>;

  beforeEach(() => {
    // Setup mocks
  });

  it('should return true when feature flag exists', async () => {
    // Test implementation
  });

  it('should return false when feature flag missing', async () => {
    // Test implementation
  });
});
```

### Integration Tests

```typescript
// feature-flag.service.integration.spec.ts
describe('FeatureFlagService Integration', () => {
  it('should check feature flags using real chain configs', async () => {
    // Integration test with real Config Service
  });
});
```

## Troubleshooting

### Feature Flag Always Returns False

1. Verify CGW service key is configured: Check `SAFE_CONFIG_CGW_KEY` environment variable
2. Verify chain configuration exists: Check Config Service v2 endpoints
3. Verify feature flag key matches exactly: Feature keys are case-sensitive
4. Check logs for warnings about unavailable chain configs

### Performance Issues

1. Verify cache is working: Check cache hit rate metrics
2. Check chain config fetch times: May indicate Config Service issues
