/**
 * Configuration options for a circuit breaker
 */
export interface CircuitBreakerConfig {
  /**
   * Number of failures required to open the circuit
   * @default 5
   */
  failureThreshold?: number;

  /**
   * Number of consecutive successes required in HALF_OPEN state
   * to close the circuit
   * @default 2
   */
  successThreshold?: number;

  /**
   * Time in milliseconds to wait before transitioning from OPEN to HALF_OPEN
   * @default 60000 (1 minute)
   */
  timeout?: number;

  /**
   * Time window in milliseconds for counting failures
   * Failures older than this are not counted
   * @default 120000 (2 minutes)
   */
  rollingWindow?: number;

  /**
   * Maximum number of test requests to allow in HALF_OPEN state
   * @default 3
   */
  halfOpenMaxRequests?: number;
}
