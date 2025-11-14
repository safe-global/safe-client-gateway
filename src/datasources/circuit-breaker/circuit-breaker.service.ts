import { Injectable } from '@nestjs/common';
import { CircuitMetrics } from '@/datasources/circuit-breaker/entities/circuit-state.entity';
import { CircuitState } from '@/datasources/circuit-breaker/enums/circuit-state.enum';
import type { CircuitBreakerConfig } from '@/datasources/circuit-breaker/interfaces/circuit-breaker-config.interface';
import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from '@/datasources/circuit-breaker/constants/circuit-breaker-config.constants';

/**
 * Circuit Breaker Service
 *
 * Implements the circuit breaker pattern to prevent cascading failures
 * when calling external endpoints. The circuit breaker tracks failures
 * and can automatically "trip" to prevent further calls to failing services.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is tripped, requests fail immediately
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 *
 */
@Injectable()
export class CircuitBreakerService {
  private readonly circuits: Map<string, CircuitMetrics> = new Map();
  private readonly configs: Map<string, Required<CircuitBreakerConfig>> =
    new Map();
  private readonly halfOpenRequestCounts: Map<string, number> = new Map();

  /**
   * Registers a circuit breaker for a specific endpoint
   *
   * @param {string} name - Unique identifier for the circuit (typically the endpoint URL or a key)
   * @param {CircuitBreakerConfig} [config] - Configuration options for this circuit
   * @returns {void}
   */
  public registerCircuit(name: string, config?: CircuitBreakerConfig): void {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, new CircuitMetrics());
    }
    // Always update config when provided
    if (config) {
      this.configs.set(name, {
        ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
        ...config,
      });
    } else if (!this.configs.has(name)) {
      this.configs.set(name, DEFAULT_CIRCUIT_BREAKER_CONFIG);
    }
  }

  /**
   * Checks if a request can proceed through the circuit
   *
   * @param {string} name - Circuit identifier
   * @returns {boolean} True if request can proceed, false if circuit is open
   */
  public canProceed(name: string): boolean {
    const circuit = this.getOrCreateCircuit(name);
    const config = this.getConfig(name);
    const now = Date.now();

    switch (circuit.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN: {
        // Check if timeout has elapsed to transition to HALF_OPEN
        if (circuit.nextAttemptTime && now >= circuit.nextAttemptTime) {
          this.transitionToHalfOpen(name);
          // Fall through to HALF_OPEN logic to check request limit
          const halfOpenCount = this.halfOpenRequestCounts.get(name) || 0;
          if (halfOpenCount < config.halfOpenMaxRequests) {
            this.halfOpenRequestCounts.set(name, halfOpenCount + 1);
            return true;
          }
          return false;
        }
        return false;
      }

      case CircuitState.HALF_OPEN: {
        // Allow limited number of test requests
        const halfOpenCount = this.halfOpenRequestCounts.get(name) || 0;
        if (halfOpenCount < config.halfOpenMaxRequests) {
          this.halfOpenRequestCounts.set(name, halfOpenCount + 1);
          return true;
        }
        return false;
      }

      default:
        return true;
    }
  }

  /**
   * Records a successful request
   *
   * @param {string} name - Circuit identifier
   * @returns {void}
   */
  public recordSuccess(name: string): void {
    const circuit = this.getOrCreateCircuit(name);
    const config = this.getConfig(name);

    circuit.successCount++;
    circuit.consecutiveSuccesses++;

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Check if we have enough consecutive successes to close the circuit
      if (circuit.consecutiveSuccesses >= config.successThreshold) {
        this.transitionToClosed(name);
      }
    } else if (circuit.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      circuit.failureCount = 0;
    }
  }

  /**
   * Records a failed request
   *
   * @param {string} name - Circuit identifier
   * @returns {void}
   */
  public recordFailure(name: string): void {
    const circuit = this.getOrCreateCircuit(name);
    const config = this.getConfig(name);
    const now = Date.now();

    circuit.failureCount++;
    circuit.lastFailureTime = now;
    circuit.consecutiveSuccesses = 0;

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN state reopens the circuit
      this.transitionToOpen(name);
    } else if (circuit.state === CircuitState.CLOSED) {
      // Check if failure threshold is exceeded
      if (circuit.failureCount >= config.failureThreshold) {
        this.transitionToOpen(name);
      }
    }
  }

  /**
   * Gets the current state of a circuit
   *
   * @param {string} name - Circuit identifier
   * @returns {CircuitState} Current circuit state
   */
  public getState(name: string): CircuitState {
    const circuit = this.getOrCreateCircuit(name);
    return circuit.state;
  }

  /**
   * Gets the metrics for a circuit
   *
   * @param {string} name - Circuit identifier
   * @returns {Readonly<CircuitMetrics>} Circuit metrics
   */
  public getMetrics(name: string): Readonly<CircuitMetrics> {
    return this.getOrCreateCircuit(name);
  }

  /**
   * Resets a circuit to its initial state
   *
   * @param {string} name - Circuit identifier
   * @returns {void}
   */
  public reset(name: string): void {
    const circuit = this.circuits.get(name);
    if (circuit) {
      circuit.reset();
      this.halfOpenRequestCounts.delete(name);
    }
  }

  /**
   * Resets all circuits
   *
   * @returns {void}
   */
  public resetAll(): void {
    this.circuits.forEach((circuit) => circuit.reset());
    this.halfOpenRequestCounts.clear();
  }

  /**
   * Transitions a circuit to OPEN state
   *
   * @param {string} name - Circuit identifier
   * @returns {void}
   */
  private transitionToOpen(name: string): void {
    const circuit = this.circuits.get(name);
    const config = this.getConfig(name);

    if (circuit) {
      circuit.state = CircuitState.OPEN;
      circuit.nextAttemptTime = Date.now() + config.timeout;
      this.halfOpenRequestCounts.delete(name);
    }
  }

  /**
   * Transitions a circuit to HALF_OPEN state
   *
   * @param {string} name - Circuit identifier
   * @returns {void}
   */
  private transitionToHalfOpen(name: string): void {
    const circuit = this.circuits.get(name);

    if (circuit) {
      circuit.state = CircuitState.HALF_OPEN;
      circuit.consecutiveSuccesses = 0;
      this.halfOpenRequestCounts.set(name, 0);
    }
  }

  /**
   * Transitions a circuit to CLOSED state
   *
   * @param {string} name - Circuit identifier
   * @returns {void}
   */
  private transitionToClosed(name: string): void {
    const circuit = this.circuits.get(name);

    if (circuit) {
      circuit.state = CircuitState.CLOSED;
      circuit.failureCount = 0;
      circuit.consecutiveSuccesses = 0;
      circuit.lastFailureTime = undefined;
      circuit.nextAttemptTime = undefined;
      this.halfOpenRequestCounts.delete(name);
    }
  }

  /**
   * Gets or creates a circuit for the given name
   *
   * @param {string} name - Circuit identifier
   * @returns {CircuitMetrics} Circuit metrics instance
   */
  private getOrCreateCircuit(name: string): CircuitMetrics {
    if (!this.circuits.has(name)) {
      this.registerCircuit(name);
    }
    return this.circuits.get(name)!;
  }

  /**
   * Gets the configuration for a circuit
   *
   * @param {string} name - Circuit identifier
   * @returns {Required<CircuitBreakerConfig>} Circuit configuration
   */
  private getConfig(name: string): Required<CircuitBreakerConfig> {
    if (!this.configs.has(name)) {
      this.configs.set(name, DEFAULT_CIRCUIT_BREAKER_CONFIG);
    }
    return this.configs.get(name)!;
  }
}
