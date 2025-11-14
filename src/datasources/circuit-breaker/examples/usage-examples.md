# Circuit Breaker Usage Examples

This document provides practical examples of using the Circuit Breaker implementation in the Safe Client Gateway.

## Table of Contents

- [Global Registration](#global-registration)
- [Basic Route Protection](#basic-route-protection)
- [Custom Configuration](#custom-configuration)
- [Custom Failure Detection](#custom-failure-detection)
- [Disabling for Specific Routes](#disabling-for-specific-routes)
- [Monitoring and Metrics](#monitoring-and-metrics)

## Global Registration

The circuit breaker is registered globally in `app.module.ts`:

```typescript
import { Module, DynamicModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CircuitBreakerModule } from '@/datasources/circuit-breaker/circuit-breaker.module';
import { CircuitBreakerInterceptor } from '@/routes/common/interceptors/circuit-breaker.interceptor';

@Module({})
export class AppModule {
  static register(): DynamicModule {
    return {
      module: AppModule,
      imports: [
        // ... other imports
        CircuitBreakerModule,
      ],
      providers: [
        {
          provide: APP_INTERCEPTOR,
          useClass: CircuitBreakerInterceptor,
        },
        // ... other providers
      ],
    };
  }
}
```

With global registration:

- All HTTP routes are automatically protected
- Each route gets its own circuit based on the route path
- Default configuration is applied to all routes
- Individual routes can customize or disable the circuit breaker using the `@CircuitBreaker()` decorator

## Basic Route Protection

Once registered globally, all routes are automatically protected with default settings:

```typescript
@Controller('api')
export class ApiController {
  constructor(private externalService: ExternalService) {}

  @Get('/data')
  async getData() {
    // Automatically protected with circuit breaker
    // Circuit name: '/data'
    // Default configuration applies
    return await this.externalService.fetch();
  }
}
```

## Custom Configuration

### Override Circuit Name and Thresholds

```typescript
@Controller('external')
export class ExternalController {
  @Get('/weather')
  @CircuitBreaker({
    name: 'weather-api', // Custom circuit name
    config: {
      failureThreshold: 3, // Open circuit after 3 failures
      successThreshold: 2, // Need 2 successes to close
      timeout: 30000, // Try again after 30 seconds
      halfOpenMaxRequests: 2, // Allow 2 concurrent requests in HALF_OPEN
    },
  })
  async getWeather() {
    return await this.weatherApi.fetch();
  }
}
```

### Aggressive Protection for Critical Services

```typescript
@Controller('payment')
export class PaymentController {
  @Post('/process')
  @CircuitBreaker({
    name: 'payment-gateway',
    config: {
      failureThreshold: 2, // Very sensitive - open after 2 failures
      successThreshold: 5, // Need 5 successes to fully trust again
      timeout: 120000, // Wait 2 minutes before retry
      halfOpenMaxRequests: 1, // Only 1 test request at a time
    },
  })
  async processPayment(@Body() payment: PaymentDto) {
    return await this.paymentGateway.process(payment);
  }
}
```

### Relaxed Protection for Non-Critical Services

```typescript
@Controller('analytics')
export class AnalyticsController {
  @Post('/track')
  @CircuitBreaker({
    name: 'analytics-service',
    config: {
      failureThreshold: 10, // Tolerate more failures
      successThreshold: 1, // Quick recovery
      timeout: 10000, // Short timeout
      halfOpenMaxRequests: 5, // Allow more test requests
    },
  })
  async trackEvent(@Body() event: EventDto) {
    return await this.analyticsService.track(event);
  }
}
```

## Custom Failure Detection

### Only Count Timeout Errors

```typescript
@Controller('search')
export class SearchController {
  @Get()
  @CircuitBreaker({
    name: 'search-engine',
    config: {
      failureThreshold: 5,
      timeout: 30000,
    },
  })
  async search(@Query() query: SearchDto) {
    try {
      return await this.searchEngine.search(query);
    } catch (error) {
      // Custom failure detection happens in the interceptor
      // but you can implement custom error handling here
      throw error;
    }
  }
}
```

**Note**: Custom `isFailure` predicates can be configured when manually instantiating the interceptor. Global interceptors use the default predicate (5xx errors).

### Default Failure Detection

By default, the circuit breaker counts the following as failures:

- Any `HttpException` with status >= 500
- Any non-HTTP exception

```typescript
// Default behavior - automatically applied
private defaultIsFailure(error: Error): boolean {
  if (error instanceof HttpException) {
    const status = error.getStatus();
    return status >= 500; // Only server errors count
  }
  return true; // Non-HTTP errors always count
}
```

## Disabling for Specific Routes

### Disable for Internal Services

```typescript
@Controller('internal')
export class InternalController {
  @Get('/health')
  @CircuitBreaker({ disabled: true })
  async healthCheck() {
    // Circuit breaker disabled - no protection
    // Useful for health checks, internal endpoints, etc.
    return { status: 'ok' };
  }

  @Get('/database-query')
  @CircuitBreaker({ disabled: true })
  async queryDatabase() {
    // Direct database access doesn't need circuit breaker
    return await this.db.query();
  }
}
```

### Mixed Protection

```typescript
@Controller('mixed')
export class MixedController {
  @Get('/external')
  @CircuitBreaker({
    name: 'external-api',
    config: { failureThreshold: 3 },
  })
  async getExternal() {
    // Protected with custom configuration
    return await this.externalApi.fetch();
  }

  @Get('/internal')
  @CircuitBreaker({ disabled: true })
  async getInternal() {
    // No protection
    return await this.internalService.fetch();
  }

  @Get('/default')
  async getDefault() {
    // Protected with default global configuration
    return await this.defaultService.fetch();
  }
}
```

## Monitoring and Metrics

### Access Circuit Metrics

```typescript
import { CircuitBreakerService } from '@/datasources/circuit-breaker/circuit-breaker.service';

@Controller('admin')
export class AdminController {
  constructor(private circuitBreakerService: CircuitBreakerService) {}

  @Get('/circuit-status/:name')
  getCircuitStatus(@Param('name') name: string) {
    const metrics = this.circuitBreakerService.getMetrics(name);

    return {
      circuitName: name,
      state: metrics.state, // 'CLOSED', 'OPEN', or 'HALF_OPEN'
      failures: metrics.failureCount,
      successes: metrics.successCount,
      consecutiveSuccesses: metrics.consecutiveSuccesses,
      lastFailure: metrics.lastFailureTime
        ? new Date(metrics.lastFailureTime).toISOString()
        : null,
      nextAttempt: metrics.nextAttemptTime
        ? new Date(metrics.nextAttemptTime).toISOString()
        : null,
    };
  }

  @Get('/all-circuits')
  getAllCircuits() {
    const allMetrics = this.circuitBreakerService.getAllMetrics();

    return Object.entries(allMetrics).map(([name, metrics]) => ({
      name,
      state: metrics.state,
      failures: metrics.failureCount,
      successes: metrics.successCount,
    }));
  }

  @Post('/reset/:name')
  resetCircuit(@Param('name') name: string) {
    this.circuitBreakerService.reset(name);
    return { message: `Circuit ${name} has been reset` };
  }

  @Post('/reset-all')
  resetAllCircuits() {
    this.circuitBreakerService.resetAll();
    return { message: 'All circuits have been reset' };
  }
}
```

### Logging Circuit State Changes

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService } from '@/datasources/circuit-breaker/circuit-breaker.service';

@Injectable()
export class CircuitMonitoringService {
  private readonly logger = new Logger(CircuitMonitoringService.name);

  constructor(private circuitBreakerService: CircuitBreakerService) {
    // Monitor circuits periodically
    setInterval(() => this.logCircuitStates(), 60000); // Every minute
  }

  private logCircuitStates(): void {
    const allMetrics = this.circuitBreakerService.getAllMetrics();

    for (const [name, metrics] of Object.entries(allMetrics)) {
      if (metrics.state !== 'CLOSED') {
        this.logger.warn(
          `Circuit ${name} is ${metrics.state}. ` +
            `Failures: ${metrics.failureCount}, ` +
            `Successes: ${metrics.successCount}`,
        );
      }
    }
  }
}
```

### Health Check Integration

```typescript
@Controller('health')
export class HealthController {
  constructor(private circuitBreakerService: CircuitBreakerService) {}

  @Get()
  getHealth() {
    const allMetrics = this.circuitBreakerService.getAllMetrics();
    const openCircuits = Object.entries(allMetrics)
      .filter(([_, metrics]) => metrics.state === 'OPEN')
      .map(([name]) => name);

    const status = openCircuits.length === 0 ? 'healthy' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      circuits: {
        total: Object.keys(allMetrics).length,
        open: openCircuits.length,
        openCircuitNames: openCircuits,
      },
    };
  }
}
```

## Best Practices

1. **Use Meaningful Circuit Names**: When overriding names, use descriptive names that indicate the external service or operation.

2. **Tune Thresholds Based on SLA**: Adjust `failureThreshold` and `timeout` based on your service level agreements and the criticality of the endpoint.

3. **Monitor Circuit States**: Implement monitoring and alerting for circuits that remain OPEN for extended periods.

4. **Test Failure Scenarios**: Simulate external service failures to verify circuit breaker behavior.

5. **Disable for Internal Endpoints**: Use `@CircuitBreaker({ disabled: true })` for health checks, metrics endpoints, and internal-only routes.

6. **Gradual Rollout**: Start with relaxed thresholds and tighten them based on observed behavior.

7. **Document Custom Configurations**: When using custom configurations, document why specific thresholds were chosen.

8. **Consider Distributed State**: For multi-instance deployments, consider using Redis or a similar distributed cache for circuit state (future enhancement).
