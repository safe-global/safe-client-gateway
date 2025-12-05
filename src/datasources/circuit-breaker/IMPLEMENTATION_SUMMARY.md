# Circuit Breaker Implementation Summary

## Overview

A complete circuit breaker pattern implementation has been added to the Safe Client Gateway application. This implementation prevents cascading failures when calling external endpoints by monitoring error rates and automatically stopping requests to failing services.

## Files Created

### Core Implementation

1. **`circuit-breaker.module.ts`** - Global module that provides circuit breaker functionality
2. **`circuit-breaker.service.ts`** - Core service that manages circuit state and tracks failures
3. **`circuit-breaker.service.spec.ts`** - Comprehensive unit tests (20 tests)

### Entity Definitions

4. **`entities/circuit-state.entity.ts`** - Defines the three circuit states (CLOSED, OPEN, HALF_OPEN) and metrics
5. **`entities/circuit-breaker-config.entity.ts`** - Configuration interface with sensible defaults

### Interceptor

6. **`routes/common/interceptors/circuit-breaker.interceptor.ts`** - NestJS interceptor for easy integration
7. **`routes/common/interceptors/circuit-breaker.interceptor.spec.ts`** - Interceptor tests (14 tests)

### Documentation

8. **`README.md`** - Comprehensive usage documentation with examples

## Circuit Breaker States

The implementation follows the classic circuit breaker pattern with three states:

```
┌─────────┐   Threshold    ┌──────┐   Timeout    ┌───────────┐
│ CLOSED  │───exceeded────>│ OPEN │─────elapsed──>│ HALF_OPEN │
│         │<───success─────│      │<────failure───│           │
└─────────┘                └──────┘               └───────────┘
```

### CLOSED

- Normal operation, all requests pass through
- Failures are counted
- Opens when failure threshold is exceeded

### OPEN

- All requests fail immediately (503 error)
- No calls to the failing service
- After timeout, transitions to HALF_OPEN

### HALF_OPEN

- Limited test requests allowed
- If requests succeed → closes circuit
- If requests fail → reopens circuit

## Configuration Options

All options are configurable per circuit:

```typescript
{
  failureThreshold: 5,        // Number of failures before opening
  successThreshold: 2,         // Successes needed to close from HALF_OPEN
  timeout: 60000,              // Time to wait before testing (ms)
  rollingWindow: 120000,       // Time window for counting failures (ms)
  halfOpenMaxRequests: 3,      // Max test requests in HALF_OPEN state
}
```

## Usage Examples

### Basic Usage

```typescript
@Get('/external-data')
@UseInterceptors(
  new CircuitBreakerInterceptor(
    this.circuitBreakerService,
    {
      name: 'external-api',
      config: {
        failureThreshold: 5,
        timeout: 60000,
      },
    }
  )
)
async getData() {
  return await this.externalService.fetchData();
}
```

### Per-Chain Circuit Breaker

```typescript
@Get('/chains/:chainId/data')
@UseInterceptors(
  new CircuitBreakerInterceptor(
    circuitBreakerService,
    {
      nameExtractor: (request) => `chain-${request.params.chainId}`,
      config: {
        failureThreshold: 3,
        timeout: 30000,
      },
    }
  )
)
async getChainData(@Param('chainId') chainId: string) {
  // Each chain gets its own circuit breaker
}
```

### Custom Failure Detection

```typescript
@Get('/data')
@UseInterceptors(
  new CircuitBreakerInterceptor(
    circuitBreakerService,
    {
      name: 'my-api',
      // Only count server errors as failures, not client errors
      isFailure: (error) => {
        if (error instanceof HttpException) {
          return error.getStatus() >= 500;
        }
        return true;
      },
    }
  )
)
async getData() {
  // Your code
}
```

## Integration

The CircuitBreakerModule has been added to `app.module.ts` as a global module, making the CircuitBreakerService available throughout the application via dependency injection.

## Testing

All tests pass successfully:

- **Circuit Breaker Service**: 20 passing tests
- **Circuit Breaker Interceptor**: 14 passing tests
- **Total**: 34 passing tests

Test coverage includes:

- Circuit registration and configuration
- State transitions (CLOSED → OPEN → HALF_OPEN → CLOSED)
- Failure and success tracking
- Threshold enforcement
- Timeout handling
- Custom configuration
- Custom failure predicates
- Circuit naming strategies

## Error Handling

When a circuit is OPEN, requests return a 503 Service Unavailable with:

```json
{
  "message": "Service temporarily unavailable due to high error rate",
  "circuitState": "OPEN",
  "circuitName": "external-api",
  "statusCode": 503
}
```

## Benefits

1. **Prevents Cascading Failures**: Stops calling failing services automatically
2. **Improves Resilience**: System continues operating even when dependencies fail
3. **Better User Experience**: Fast failures instead of long timeouts
4. **Resource Protection**: Prevents thread/connection pool exhaustion
5. **Automatic Recovery**: Tests service health and recovers automatically
6. **Configurable**: Tune thresholds per service based on reliability
7. **Observable**: Track circuit states and metrics for monitoring

## References

- [Circuit Breaker Pattern - Wikipedia](https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern)
- [Circuit Breaker Pattern - Medium Article](https://medium.com/geekculture/design-patterns-for-microservices-circuit-breaker-pattern-276249ffab33)
- [Release It! by Michael Nygard](https://pragprog.com/titles/mnee2/release-it-second-edition/)
