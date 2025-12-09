import type { ICircuitBreakerConfig } from '@/datasources/circuit-breaker/interfaces/circuit-breaker.interface';

/**
 * Options for configuring the circuit breaker interceptor
 */
export interface CircuitBreakerInterceptorOptions {
  /**
   * Unique name for this circuit. If not provided, uses the route path
   */
  name?: string;

  /**
   * Circuit breaker configuration
   */
  config?: ICircuitBreakerConfig;

  /**
   * Predicate to determine if an error should be counted as a failure
   * By default, only 5xx errors and network errors are counted
   */
  isFailure: (error: Error) => boolean;

  /**
   * Custom error message when circuit is open
   */
  openCircuitMessage: string;
}
