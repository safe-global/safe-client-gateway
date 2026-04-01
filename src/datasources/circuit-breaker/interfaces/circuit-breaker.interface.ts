// SPDX-License-Identifier: FSL-1.1-MIT
import type { CircuitState } from '@/datasources/circuit-breaker/enums/circuit-state.enum';

/**
 * Configuration options for a circuit breaker
 */
export interface ICircuitConfig {
  /**
   * Number of failures to open the circuit (CLOSED state),
   * and consecutive successes to close it (HALF_OPEN state)
   */
  threshold: number;

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
   * Percentage of threshold used in HALF_OPEN state (0–100)
   * E.g. 30 with threshold 10 means 3 failures reopen the circuit
   */
  halfOpenFailureRateThreshold: number;
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
 * Complete circuit breaker instance
 */
export interface ICircuit {
  /**
   * Unique name for this circuit
   */
  name: string;

  /**
   * Current metrics and state information
   */
  metrics: ICircuitMetrics;
}
