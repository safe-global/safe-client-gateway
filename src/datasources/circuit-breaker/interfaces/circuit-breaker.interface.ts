import type { CircuitState } from '@/datasources/circuit-breaker/enums/circuit-state.enum';

/**
 * Configuration options for a circuit breaker
 */
export interface ICircuitConfig {
  /**
   * Number of failures required to open the circuit
   */
  failureThreshold: number;

  /**
   * Number of consecutive successes required in HALF_OPEN state to close the circuit
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
export interface ICircuitMetrics {
  /**
   * Current state of the circuit
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

  /**
   * Map tracking the number of requests made in HALF_OPEN state for a circuit
   */
  halfOpenRequestCounts: number;
}

/**
 * Complete circuit breaker instance
 */
export interface ICircuit {
  /**
   * Unique name for this circuit
   */
  name: string;

  /**
   * Configuration settings for this circuit breaker
   */
  config: ICircuitConfig;

  /**
   * Current metrics and state information
   */
  metrics: ICircuitMetrics;
}
