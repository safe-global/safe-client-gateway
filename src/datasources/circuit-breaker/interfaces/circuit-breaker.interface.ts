import type { CircuitState } from '@/datasources/circuit-breaker/enums/circuit-state.enum';

/**
 * Configuration options for a circuit breaker
 */
export interface ICircuitBreakerConfig {
  /**
   * Number of failures required to open the circuit
   */
  failureThreshold: number;

  /**
   * Number of consecutive successes required in HALF_OPEN state
   * to close the circuit
   */
  successThreshold: number;

  /**
   * Time in milliseconds to wait before transitioning from OPEN to HALF_OPEN
   */
  timeout: number;

  /**
   * Time window in milliseconds for counting failures
   * Failures older than this are not counted
   */
  rollingWindow: number;

  /**
   * Maximum number of test requests to allow in HALF_OPEN state
   */
  halfOpenMaxRequests: number;
}

/**
 * Metrics tracking the current state and performance of a circuit breaker
 */
export interface ICircuitBreakerMetrics {
  /**
   * Current state of the circuit (CLOSED, OPEN, or HALF_OPEN)
   */
  state: CircuitState;

  /**
   * Total number of failures recorded
   */
  failureCount: number;

  /**
   * Total number of successful requests recorded
   */
  successCount: number;

  /**
   * Timestamp of the last failure occurrence
   */
  lastFailureTime?: number;

  /**
   * Timestamp when the next attempt should be allowed (used in OPEN state)
   */
  nextAttemptTime?: number;

  /**
   * Number of consecutive successful requests (used in HALF_OPEN state)
   */
  consecutiveSuccesses: number;
}

/**
 * Complete circuit breaker instance containing configuration and current metrics
 */
export interface ICircuitBreaker {
  /**
   * Unique name for this circuit
   */
  name: string;

  /**
   * Configuration settings for this circuit breaker
   */
  config: ICircuitBreakerConfig;

  /**
   * Current metrics and state information
   */
  metrics: ICircuitBreakerMetrics;
}
