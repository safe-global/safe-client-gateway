/**
 * Basic Circuit Breaker implementation
 *
 * A circuit breaker prevents cascading failures by stopping calls to a failing service
 * after a threshold of failures is reached. It has three states:
 * - CLOSED: Normal operation, requests are allowed
 * - OPEN: Service is failing, requests are immediately rejected
 * - HALF_OPEN: Testing if service has recovered, allows one test request
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold: number;
  /** Time in milliseconds to wait before attempting recovery (half-open state) */
  resetTimeout: number;
}

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number | null;
  successCount: number;
}

export class CircuitBreaker {
  private circuits: Map<string, CircuitBreakerState> = new Map();
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeout: config.resetTimeout ?? 60000, // 60 seconds default
    };
  }

  /**
   * Execute a function with circuit breaker protection
   * @param key Unique identifier for this circuit (e.g., chainId)
   * @param fn Function to execute
   * @returns Result of the function or throws an error
   */
  async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const circuit = this.getOrCreateCircuit(key);
    const currentState = this.getCurrentState(key, circuit);

    // If circuit is OPEN, reject immediately
    if (currentState === CircuitState.OPEN) {
      throw new CircuitBreakerOpenError(
        `Circuit breaker is OPEN for key: ${key}`,
      );
    }

    // If circuit is HALF_OPEN, only allow one request
    if (currentState === CircuitState.HALF_OPEN && circuit.successCount > 0) {
      throw new CircuitBreakerOpenError(
        `Circuit breaker is HALF_OPEN for key: ${key}, test request already in progress`,
      );
    }

    try {
      const result = await fn();

      // Success - reset failure count and close circuit if needed
      this.onSuccess(key, circuit);
      return result;
    } catch (error) {
      // Failure - increment failure count and potentially open circuit
      this.onFailure(key, circuit);
      throw error;
    }
  }

  /**
   * Get the current state of a circuit, considering time-based recovery
   */
  private getCurrentState(
    key: string,
    circuit: CircuitBreakerState,
  ): CircuitState {
    // If circuit is OPEN and enough time has passed, transition to HALF_OPEN
    if (
      circuit.state === CircuitState.OPEN &&
      circuit.lastFailureTime !== null
    ) {
      const timeSinceLastFailure = Date.now() - circuit.lastFailureTime;
      if (timeSinceLastFailure >= this.config.resetTimeout) {
        circuit.state = CircuitState.HALF_OPEN;
        circuit.successCount = 0;
      }
    }

    return circuit.state;
  }

  /**
   * Handle successful execution
   */
  private onSuccess(key: string, circuit: CircuitBreakerState): void {
    if (circuit.state === CircuitState.HALF_OPEN) {
      // Test request succeeded - close the circuit
      circuit.state = CircuitState.CLOSED;
      circuit.failureCount = 0;
      circuit.successCount = 0;
      circuit.lastFailureTime = null;
    } else {
      // Normal success - reset failure count
      circuit.failureCount = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(key: string, circuit: CircuitBreakerState): void {
    circuit.failureCount++;
    circuit.lastFailureTime = Date.now();

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Test request failed - reopen the circuit
      circuit.state = CircuitState.OPEN;
      circuit.successCount = 0;
    } else if (
      circuit.failureCount >= this.config.failureThreshold &&
      circuit.state === CircuitState.CLOSED
    ) {
      // Threshold reached - open the circuit
      circuit.state = CircuitState.OPEN;
    }
  }

  /**
   * Get or create a circuit state for a given key
   */
  private getOrCreateCircuit(key: string): CircuitBreakerState {
    if (!this.circuits.has(key)) {
      this.circuits.set(key, {
        state: CircuitState.CLOSED,
        failureCount: 0,
        lastFailureTime: null,
        successCount: 0,
      });
    }
    return this.circuits.get(key)!;
  }

  /**
   * Get the current state of a circuit (for monitoring/debugging)
   */
  getState(key: string): CircuitState {
    const circuit = this.getOrCreateCircuit(key);
    return this.getCurrentState(key, circuit);
  }

  /**
   * Manually reset a circuit (for testing or manual recovery)
   */
  reset(key: string): void {
    this.circuits.delete(key);
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    this.circuits.clear();
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}
