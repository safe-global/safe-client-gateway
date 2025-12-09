import { Inject, Injectable } from '@nestjs/common';
import { CircuitState } from '@/datasources/circuit-breaker/enums/circuit-state.enum';
import type {
  ICircuitBreaker,
  ICircuitBreakerConfig,
  ICircuitBreakerMetrics,
} from '@/datasources/circuit-breaker/interfaces/circuit-breaker.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';

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
  private readonly DEFAULT_STATE: CircuitState = CircuitState.CLOSED;

  private readonly initialConfig: ICircuitBreakerConfig;
  private readonly circuits: Map<string, ICircuitBreaker> = new Map();
  private readonly halfOpenRequestCounts: Map<string, number> = new Map();

  /**
   * Creates a new CircuitBreakerService instance and loads default configuration
   *
   * @param {IConfigurationService} configurationService - Configuration service for loading circuit breaker settings
   */
  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.initialConfig = {
      failureThreshold: this.configurationService.getOrThrow(
        'circuitBreaker.failureThreshold',
      ),
      successThreshold: this.configurationService.getOrThrow(
        'circuitBreaker.successThreshold',
      ),
      timeout: this.configurationService.getOrThrow('circuitBreaker.timeout'),
      rollingWindow: this.configurationService.getOrThrow(
        'circuitBreaker.rollingWindow',
      ),
      halfOpenMaxRequests: this.configurationService.getOrThrow(
        'circuitBreaker.halfOpenMaxRequests',
      ),
    };
  }

  /**
   * Checks if a request can proceed through the circuit
   *
   * If no circuit exists, the endpoint is considered healthy and the request proceeds.
   * Circuits are only created when failures occur.
   *
   * @param {string} name - Circuit identifier
   *
   * @returns {boolean} True if request can proceed, false if circuit is open
   */
  public canProceed(name: string): boolean {
    const circuit = this.get(name);

    if (!circuit) {
      return true;
    }

    switch (circuit.metrics.state) {
      case CircuitState.OPEN:
        return this.handleOpenState(circuit);
      case CircuitState.HALF_OPEN:
        return this.handleHalfOpenState(circuit);
      case CircuitState.CLOSED:
      default:
        return this.handleDefaultState();
    }
  }

  /**
   * Gets an existing circuit or registers a new one if it doesn't exist
   *
   * This method ensures that a circuit is always available for the given name,
   * creating it with the provided configuration if needed.
   *
   * @param {string} name - Unique identifier for the circuit (typically the endpoint URL or service name)
   * @param {CircuitBreakerConfig} [config] - Optional configuration for the circuit (used only if circuit doesn't exist)
   *
   * @returns {Circuit} The circuit instance for the given name
   */
  public getOrRegisterCircuit(
    name: string,
    config?: ICircuitBreakerConfig,
  ): ICircuitBreaker {
    return this.get(name) ?? this.registerCircuit(name, config);
  }

  /**
   * Creates and registers a new circuit with the given configuration
   *
   * Merges the provided config with default configuration values.
   * Note: This will overwrite any existing circuit with the same name.
   *
   * @param {string} name - Unique identifier for the circuit
   * @param {CircuitBreakerConfig} [config] - Optional configuration to override defaults
   *
   * @returns {ICircuitBreaker} The registered circuit
   */
  private registerCircuit(
    name: string,
    config?: ICircuitBreakerConfig,
  ): ICircuitBreaker {
    const initialMetrics: ICircuitBreakerMetrics = {
      failureCount: 0,
      successCount: 0,
      consecutiveSuccesses: 0,
      state: this.DEFAULT_STATE,
      lastFailureTime: undefined,
      nextAttemptTime: undefined,
    };

    const circuit: ICircuitBreaker = {
      name,
      metrics: initialMetrics,
      config: {
        ...this.initialConfig,
        ...config,
      },
    };

    this.circuits.set(name, circuit);

    return circuit;
  }

  /**
   * Retrieves an existing circuit by name
   *
   * @param {string} name - Circuit identifier
   * @returns {Circuit | undefined} The circuit instance or undefined if not found
   */
  public get(name: string): ICircuitBreaker | undefined {
    return this.circuits.get(name);
  }

  /**
   * Handles circuit logic when in OPEN state
   *
   * Checks if enough time has elapsed to transition to HALF_OPEN state.
   * If the timeout has passed, transitions to HALF_OPEN and allows a test request.
   *
   * @param {Circuit} circuit - The circuit instance
   *
   * @returns {boolean} True if request can proceed (after timeout), false otherwise
   */
  private handleOpenState(circuit: ICircuitBreaker): boolean {
    const now = Date.now();
    if (
      circuit.metrics.nextAttemptTime &&
      now >= circuit.metrics.nextAttemptTime
    ) {
      this.transitionToHalfOpen(circuit);
      return this.handleHalfOpenState(circuit);
    }
    return false;
  }

  /**
   * Transitions a circuit from OPEN to HALF_OPEN state
   *
   * In HALF_OPEN state, the circuit allows a limited number of test requests
   * to determine if the downstream service has recovered.
   *
   * @param {ICircuitBreaker} circuit - Circuit breaker
   * @returns {void}
   */
  private transitionToHalfOpen(circuit: ICircuitBreaker): void {
    if (circuit) {
      circuit.metrics.consecutiveSuccesses = 0;
      circuit.metrics.state = CircuitState.HALF_OPEN;
      this.halfOpenRequestCounts.set(circuit.name, 0);
    }
  }

  /**
   * Handles circuit logic when in HALF_OPEN state
   *
   * Allows a limited number of test requests through to check if the service has recovered.
   * Once the maximum number of test requests is reached, additional requests are blocked.
   *
   * @param {string} name - Circuit identifier
   * @param {Circuit} circuit - The circuit instance
   * @returns {boolean} True if request can proceed (within limit), false if limit reached
   */
  private handleHalfOpenState(circuit: ICircuitBreaker): boolean {
    const halfOpenCount = this.halfOpenRequestCounts.get(circuit.name) || 0;
    if (halfOpenCount < circuit.config.halfOpenMaxRequests) {
      this.halfOpenRequestCounts.set(circuit.name, halfOpenCount + 1);
      return true;
    }

    return false;
  }

  /**
   * Handles circuit logic for default/CLOSED state
   *
   * In CLOSED state, all requests are allowed through.
   *
   * @returns {boolean} Always returns true (requests allowed)
   */
  private handleDefaultState(): boolean {
    return true;
  }

  /**
   * Records a successful request for the circuit
   *
   * Only processes success if circuit is being tracked (has had failures).
   * Updates success metrics and handles state transitions:
   * - In HALF_OPEN: Transitions to CLOSED and cleans up (circuit recovered from failures)
   * - In CLOSED: Resets failure count (maintains circuit for ongoing monitoring)
   *
   * @param {ICircuitBreaker} circuit - Circuit Breaker
   *
   * @returns {void}
   */
  public recordSuccess(circuit: ICircuitBreaker): void {
    circuit.metrics.successCount++;
    circuit.metrics.consecutiveSuccesses++;

    if (circuit.metrics.state === CircuitState.HALF_OPEN) {
      // Circuit recovering from failures - close and cleanup
      if (
        circuit.metrics.consecutiveSuccesses >= circuit.config.successThreshold
      ) {
        this.transitionToClosedAndCleanup(circuit);
      }
    } else if (circuit.metrics.state === CircuitState.CLOSED) {
      // Reset failure count on success in healthy state
      circuit.metrics.failureCount = 0;
    }
  }

  /**
   * Transitions a circuit to CLOSED state and removes it from memory
   *
   * Resets all failure metrics and clears timeout settings.
   * The circuit is now healthy and removed from tracking to save memory.
   *
   * @param {string} name - Circuit identifier
   * @returns {void}
   */
  private transitionToClosedAndCleanup(circuit: ICircuitBreaker): void {
    this.removeCircuit(circuit);
  }

  /**
   * Removes a circuit from memory
   *
   * Used to clean up healthy circuits to prevent memory exhaustion.
   * Circuit will be recreated if failures occur again.
   *
   * @param {ICircuitBreaker} circuit - Circuit identifier
   * @returns {void}
   */
  private removeCircuit(circuit: ICircuitBreaker): void {
    this.circuits.delete(circuit.name);
    this.halfOpenRequestCounts.delete(circuit.name);
  }

  /**
   * Records a failed request for the circuit
   *
   * Creates circuit on first failure (lazy initialization).
   * Updates failure metrics and handles state transitions:
   * - In HALF_OPEN: Any failure immediately reopens the circuit
   * - In CLOSED: Opens circuit if failure threshold is exceeded
   *
   * @param {ICircuitBreaker} circuit - Circuit Breaker
   *
   * @returns {void}
   */
  public recordFailure(circuit: ICircuitBreaker): void {
    // Create circuit on first failure (lazy initialization)
    const now = Date.now();

    // Clean up failures outside the rolling window
    if (
      circuit.metrics.lastFailureTime &&
      now - circuit.metrics.lastFailureTime > circuit.config.rollingWindow
    ) {
      circuit.metrics.failureCount = 0;
    }

    circuit.metrics.failureCount++;
    circuit.metrics.lastFailureTime = now;
    circuit.metrics.consecutiveSuccesses = 0;

    if (circuit.metrics.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen(circuit);
    } else if (circuit.metrics.state === CircuitState.CLOSED) {
      if (circuit.metrics.failureCount >= circuit.config.failureThreshold) {
        this.transitionToOpen(circuit);
      }
    }
  }

  /**
   * Transitions a circuit to OPEN state (tripped/failing)
   *
   * Sets a timeout after which the circuit will transition to HALF_OPEN
   * to test if the downstream service has recovered. All requests are
   * blocked until the timeout expires.
   *
   * @param {string} name - Circuit identifier
   * @returns {void}
   */
  private transitionToOpen(circuit: ICircuitBreaker): void {
    circuit.metrics.state = CircuitState.OPEN;
    circuit.metrics.nextAttemptTime = Date.now() + circuit.config.timeout;
    this.halfOpenRequestCounts.delete(circuit.name);
  }

  /**
   * Delete a specific circuit
   *
   * @param {string} name - Circuit identifier to delete
   *
   * @returns {void}
   */
  public delete(name: string): void {
    const circuit = this.circuits.get(name);
    if (circuit) {
      this.circuits.delete(name);
      this.halfOpenRequestCounts.delete(name);
    }
  }

  /**
   * Deletes all registered circuits
   *
   * @returns {void}
   */
  public deleteAll(): void {
    this.circuits.clear();
    this.halfOpenRequestCounts.clear();
  }
}
