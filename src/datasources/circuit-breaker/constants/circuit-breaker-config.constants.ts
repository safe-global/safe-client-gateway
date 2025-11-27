import type { CircuitBreakerConfig } from '@/datasources/circuit-breaker/interfaces/circuit-breaker-config.interface';

/**
 * Default configuration values for circuit breakers
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60_000, // 1 minute
  rollingWindow: 120_000, // 2 minutes
  halfOpenMaxRequests: 3,
};
