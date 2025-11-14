import type { Request } from 'express';
import type { CircuitBreakerConfig } from '@/datasources/circuit-breaker/interfaces/circuit-breaker-config.interface';

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
  config?: CircuitBreakerConfig;

  /**
   * Function to determine the circuit name from the request
   * Useful for creating per-endpoint or per-chain circuits
   */
  nameExtractor?: (request: Request) => string;

  /**
   * Predicate to determine if an error should be counted as a failure
   * By default, all errors are counted
   */
  isFailure?: (error: Error) => boolean;

  /**
   * Custom error message when circuit is open
   */
  openCircuitMessage?: string;
}
