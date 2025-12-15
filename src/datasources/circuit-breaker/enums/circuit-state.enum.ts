/**
 * Represents the possible states of a circuit breaker
 * Based on the circuit breaker design pattern
 */
export enum CircuitState {
  /**
   * Circuit is closed - requests pass through normally
   * Failures are counted and if threshold is exceeded, circuit opens
   */
  CLOSED = 'CLOSED',

  /**
   * Circuit is open - requests fail immediately without calling the endpoint
   * After timeout period, circuit transitions to HALF_OPEN
   */
  OPEN = 'OPEN',

  /**
   * Circuit is half-open - limited test requests are allowed
   * If requests succeed, circuit closes. If they fail, circuit reopens
   */
  HALF_OPEN = 'HALF_OPEN',
}
