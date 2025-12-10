import { Inject, Injectable } from '@nestjs/common';
import { CircuitState } from '@/datasources/circuit-breaker/enums/circuit-state.enum';
import type {
  ICircuit,
  ICircuitConfig,
} from '@/datasources/circuit-breaker/interfaces/circuit-breaker.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';

/**
 * Circuit Breaker Service
 *
 * Implements the circuit breaker pattern to prevent cascading failures
 * when calling external endpoints. The circuit breaker tracks failures
 * and can automatically "trip" to prevent further calls to failing services.
 *
 */
@Injectable()
export class CircuitBreakerService {
  private readonly DEFAULT_STATE: CircuitState = CircuitState.CLOSED;

  private readonly initialConfig: ICircuitConfig;
  private readonly circuits: Map<string, ICircuit> = new Map();

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
    const circuit = this.circuits.get(name);

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
   * @param {string} name - Unique identifier for the circuit
   * @param {ICircuitConfig} config? - Optional configuration for the circuit (used only if circuit doesn't exist)
   *
   * @returns {ICircuit} The circuit instance for the given name
   */
  public getOrRegisterCircuit(name: string, config?: ICircuitConfig): ICircuit {
    return this.circuits.get(name) ?? this.registerCircuit(name, config);
  }

  /**
   * Creates and registers a new circuit with the given configuration
   *
   * Merges the provided config with default configuration values.
   * Note: This will overwrite any existing circuit with the same name.
   *
   * @param {string} name - Unique identifier for the circuit
   * @param {ICircuitConfig} config? - Optional configuration to override defaults
   *
   * @returns {ICircuit} The registered circuit
   */
  private registerCircuit(name: string, config?: ICircuitConfig): ICircuit {
    const circuit: ICircuit = {
      name,
      metrics: {
        failureCount: 0,
        successCount: 0,
        consecutiveSuccesses: 0,
        halfOpenRequestCounts: 0,
        state: this.DEFAULT_STATE,
        lastFailureTime: undefined,
        nextAttemptTime: undefined,
      },
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
   *
   * @returns {ICircuit | undefined} The circuit instance or undefined if not found
   */
  public get(name: string): ICircuit | undefined {
    return this.circuits.get(name);
  }

  /**
   * Handles circuit logic when in OPEN state
   *
   * Checks if enough time has elapsed to transition to HALF_OPEN state.
   * If the timeout has passed, transitions to HALF_OPEN and allows a test request.
   *
   * @param {ICircuit} circuit - The circuit instance
   *
   * @returns {boolean} True if request can proceed (after timeout), false otherwise
   */
  private handleOpenState(circuit: ICircuit): boolean {
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
   * @param {ICircuit} circuit - Circuit breaker
   *
   * @returns {void}
   */
  private transitionToHalfOpen(circuit: ICircuit): void {
    circuit.metrics.consecutiveSuccesses = 0;
    circuit.metrics.state = CircuitState.HALF_OPEN;
    circuit.metrics.halfOpenRequestCounts = 0;
  }

  /**
   * Handles circuit logic when in HALF_OPEN state
   *
   * Allows a limited number of test requests through to check if the service has recovered.
   * Once the maximum number of test requests is reached, additional requests are blocked.
   *
   * @param {ICircuit} circuit - The circuit instance
   *
   * @returns {boolean} True if request can proceed (within limit), false if limit reached
   */
  private handleHalfOpenState(circuit: ICircuit): boolean {
    if (
      circuit.metrics.halfOpenRequestCounts < circuit.config.halfOpenMaxRequests
    ) {
      circuit.metrics.halfOpenRequestCounts++;

      return true;
    }

    return false;
  }

  /**
   * Handles circuit logic for default state
   *
   * In default state, all requests are allowed through.
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
   * - In HALF_OPEN: Transitions to CLOSED when the success threshold is reached and removes the circuit from memory
   *
   * @param {ICircuit} circuit - Circuit Breaker
   *
   * @returns {void}
   */
  public recordSuccess(circuit: ICircuit): void {
    circuit.metrics.consecutiveSuccesses++;

    if (circuit.metrics.state === CircuitState.HALF_OPEN) {
      if (
        circuit.metrics.consecutiveSuccesses >= circuit.config.successThreshold
      ) {
        this.removeCircuit(circuit);
      }
    }
  }

  /**
   * Removes a circuit from memory
   *
   * Used to clean up healthy circuits to prevent memory exhaustion.
   * Circuit will be recreated if failures occur again.
   *
   * @param {ICircuit} circuit - Circuit identifier
   * @returns {void}
   */
  private removeCircuit(circuit: ICircuit): void {
    this.circuits.delete(circuit.name);
  }

  /**
   * Records a failed request for the circuit
   *
   * Updates failure metrics and handles state transitions:
   * - In HALF_OPEN: Any failure immediately reopens the circuit
   * - In CLOSED: Opens circuit if failure threshold is exceeded
   *
   * @param {ICircuit} circuit - Circuit Breaker
   *
   * @returns {void}
   */
  public recordFailure(circuit: ICircuit): void {
    const now = Date.now();

    this.discardOldFailures(circuit, now);

    circuit.metrics.failureCount++;
    circuit.metrics.lastFailureTime = now;
    circuit.metrics.consecutiveSuccesses = 0;

    if (
      circuit.metrics.state === CircuitState.HALF_OPEN ||
      (circuit.metrics.state === CircuitState.CLOSED && // If Closed
        circuit.metrics.failureCount >= circuit.config.failureThreshold) // And failure count exceeds threshold
    ) {
      this.transitionToOpen(circuit);
    }
  }

  /**
   * Discards old failure records that fall outside the rolling window
   *
   * This method implements the rolling window pattern for failure tracking.
   * If the last failure occurred outside the configured rolling window period,
   * all failure counts are reset to prevent stale failures from affecting
   * circuit state decisions.
   *
   * @param {ICircuit} circuit - The circuit to clean up old failures for
   * @param {number} currentTimestamp - Current timestamp in milliseconds
   *
   * @returns {void}
   */
  private discardOldFailures(
    circuit: ICircuit,
    currentTimestamp: number,
  ): void {
    if (
      circuit.metrics.lastFailureTime &&
      currentTimestamp - circuit.metrics.lastFailureTime >
        circuit.config.rollingWindow
    ) {
      circuit.metrics.failureCount = 0;
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
  private transitionToOpen(circuit: ICircuit): void {
    circuit.metrics.state = CircuitState.OPEN;
    circuit.metrics.nextAttemptTime = Date.now() + circuit.config.timeout;
  }

  /**
   * Delete a specific circuit
   *
   * @param {string} name - Circuit identifier to delete
   *
   * @returns {void}
   */
  public delete(name: string): void {
    this.circuits.delete(name);
  }

  /**
   * Deletes all registered circuits
   *
   * @returns {void}
   */
  public deleteAll(): void {
    this.circuits.clear();
  }
}
