# Circuit Breaker Implementation

This directory contains the implementation of the Circuit Breaker pattern for the Safe Client Gateway.

## Overview

The Circuit Breaker pattern prevents cascading failures in distributed systems by monitoring external service calls and temporarily blocking requests when error rates exceed configured thresholds.

### Circuit States

1. **CLOSED**: Normal operation - all requests pass through
2. **OPEN**: Service is failing - requests are blocked
3. **HALF_OPEN**: Testing if service recovered - limited requests allowed

## Components

### Core Service

- **`circuit-breaker.service.ts`**: Manages circuit state and metrics
- **`circuit-breaker.module.ts`**: NestJS module for dependency injection

### Interceptor

- **`circuit-breaker.interceptor.ts`**: HTTP interceptor that applies circuit breaker logic to routes
- **`circuit-breaker.decorator.ts`**: Decorator for route-specific circuit breaker configuration

### Types

- **`enums/circuit-state.enum.ts`**: Circuit state enumeration
- **`interfaces/circuit-breaker-config.interface.ts`**: Configuration interface
- **`interfaces/circuit-breaker-interceptor-options.interface.ts`**: Interceptor options interface
- **`entities/circuit-state.entity.ts`**: Circuit metrics entity
- **`constants/circuit-breaker-config.constants.ts`**: Default configuration constants

## Usage

### Global Registration

Register the circuit breaker as a global interceptor in `app.module.ts`:

```typescript
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CircuitBreakerInterceptor } from '@/routes/common/interceptors/circuit-breaker.interceptor';
import { CircuitBreakerModule } from '@/datasources/circuit-breaker/circuit-breaker.module';

@Module({
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
})
export class AppModule {}
```

When registered globally, the circuit breaker will:

- Use the route path as the circuit name
- Apply default configuration to all routes
- Allow per-route customization via the `@CircuitBreaker()` decorator

### Route-Specific Configuration

Use the `@CircuitBreaker()` decorator to customize circuit breaker behavior for specific routes:

```typescript
import { CircuitBreaker } from '@/routes/common/decorators/circuit-breaker.decorator';

@Controller('external-api')
export class ExternalApiController {
  @Get('/data')
  @CircuitBreaker({
    name: 'external-api-data',
    config: {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000, // 30 seconds
      halfOpenMaxRequests: 2,
    },
  })
  async getData() {
    return await this.externalService.fetchData();
  }

  @Get('/internal')
  @CircuitBreaker({ disabled: true })
  async getInternalData() {
    // Circuit breaker disabled for this route
    return await this.internalService.fetchData();
  }
}
```

### Manual Integration (Without Decorator)

For more control, instantiate the interceptor directly:

```typescript
import { CircuitBreakerInterceptor } from '@/routes/common/interceptors/circuit-breaker.interceptor';
import { CircuitBreakerService } from '@/datasources/circuit-breaker/circuit-breaker.service';

@Controller('custom')
@UseInterceptors(
  new CircuitBreakerInterceptor(new CircuitBreakerService(), new Reflector(), {
    name: 'custom-circuit',
    config: {
      failureThreshold: 5,
      timeout: 60000,
    },
    isFailure: (error) => error.message.includes('timeout'),
  }),
)
export class CustomController {
  // ...
}
```

## Configuration Options

### Circuit Breaker Config

| Option                | Type   | Default | Description                                                |
| --------------------- | ------ | ------- | ---------------------------------------------------------- |
| `failureThreshold`    | number | 5       | Number of failures before opening circuit                  |
| `successThreshold`    | number | 2       | Number of successes needed to close circuit from HALF_OPEN |
| `timeout`             | number | 60000   | Time (ms) before transitioning from OPEN to HALF_OPEN      |
| `rollingWindow`       | number | 120000  | Time window (ms) for counting failures                     |
| `halfOpenMaxRequests` | number | 3       | Maximum concurrent requests in HALF_OPEN state             |

### Interceptor Options

| Option               | Type                 | Description                                             |
| -------------------- | -------------------- | ------------------------------------------------------- |
| `name`               | string               | Unique circuit identifier                               |
| `nameExtractor`      | function             | Function to extract circuit name from request           |
| `config`             | CircuitBreakerConfig | Circuit breaker configuration                           |
| `isFailure`          | function             | Predicate to determine if error should count as failure |
| `openCircuitMessage` | string               | Error message when circuit is open                      |

### Decorator Options

| Option     | Type                 | Description                            |
| ---------- | -------------------- | -------------------------------------- |
| `name`     | string               | Override circuit name for this route   |
| `config`   | CircuitBreakerConfig | Override circuit configuration         |
| `disabled` | boolean              | Disable circuit breaker for this route |

## Testing

Run the test suite:

```bash
yarn test src/datasources/circuit-breaker/
yarn test src/routes/common/interceptors/circuit-breaker.interceptor.spec.ts
```

## Examples

### Example 1: Basic Usage

```typescript
@Get('/external')
@CircuitBreaker({
  name: 'external-api',
  config: {
    failureThreshold: 3,
    timeout: 30000,
  },
})
async getExternalData() {
  return await this.externalApi.fetch();
}
```

### Example 2: Custom Failure Detection

```typescript
@Get('/timeout-sensitive')
@CircuitBreaker({
  name: 'timeout-api',
  config: {
    failureThreshold: 2,
    timeout: 15000,
  },
})
async getTimeoutSensitiveData() {
  // Only timeout errors will count as failures if using custom isFailure predicate
  return await this.api.fetch();
}
```

### Example 3: Disable for Specific Routes

```typescript
@Get('/internal')
@CircuitBreaker({ disabled: true })
async getInternalData() {
  // No circuit breaker protection
  return await this.internalDb.query();
}
```

## Monitoring

Access circuit metrics via the `CircuitBreakerService`:

```typescript
constructor(private circuitBreakerService: CircuitBreakerService) {}

getMetrics() {
  const metrics = this.circuitBreakerService.getMetrics('my-circuit');
  return {
    state: metrics.state,
    failures: metrics.failureCount,
    successes: metrics.successCount,
  };
}
```

## Architecture Decisions

1. **Stateful Service**: The `CircuitBreakerService` maintains state in memory. For distributed systems, consider using Redis or a similar distributed cache.

2. **Per-Route Circuits**: By default, each route gets its own circuit. This prevents one failing endpoint from affecting others.

3. **Graceful Degradation**: When the circuit is OPEN, requests fail fast with a `503 Service Unavailable` response, preventing resource exhaustion.

4. **Configurable Failure Detection**: Custom `isFailure` predicates allow fine-grained control over what constitutes a "failure" (e.g., only 5xx errors, specific error messages, timeouts, etc.).

5. **Global with Per-Route Overrides**: The interceptor can be registered globally while allowing individual routes to customize or disable circuit breaker behavior.

## References

- [Circuit Breaker Pattern (Wikipedia)](https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern)
- [Circuit Breaker (Martin Fowler)](https://martinfowler.com/bliki/CircuitBreaker.html)
