import { CircuitState } from '@/datasources/circuit-breaker/enums/circuit-state.enum';

/**
 * Stores the state and metrics for a single circuit
 */
export class CircuitMetrics {
  public state: CircuitState = CircuitState.CLOSED;
  public failureCount: number = 0;
  public successCount: number = 0;
  public lastFailureTime?: number;
  public nextAttemptTime?: number;
  public consecutiveSuccesses: number = 0;

  /**
   * Creates a new CircuitMetrics instance
   *
   * @param {CircuitState} [initialState=CircuitState.CLOSED] - The initial state of the circuit
   */
  public constructor(initialState: CircuitState = CircuitState.CLOSED) {
    this.state = initialState;
  }

  /**
   * Resets all metrics to initial state
   *
   * @returns {void}
   */
  public reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
  }
}
