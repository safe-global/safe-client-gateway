// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { CircuitState } from '@/datasources/circuit-breaker/enums/circuit-state.enum';
import type {
  ICircuit,
  ICircuitConfig,
} from '@/datasources/circuit-breaker/interfaces/circuit-breaker.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CircuitBreakerException } from '@/datasources/circuit-breaker/exceptions/circuit-breaker.exception';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';

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
  private readonly STALE_BUFFER_FACTOR: number = 2;

  private readonly enabled: boolean;
  private readonly initialConfig: ICircuitConfig;
  private readonly circuits: Map<string, ICircuit> = new Map();

  /**
   * Creates a new CircuitBreakerService instance and loads default configuration
   *
   * @param {IConfigurationService} configurationService - Configuration service for loading circuit breaker settings
   * @param {ILoggingService} loggingService - Logging service for tracking circuit breaker state changes
   */
  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.enabled = this.configurationService.getOrThrow<boolean>(
      'circuitBreaker.enabled',
    );
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
   * Checks if the circuit breaker is enabled
   *
   * @returns {boolean} True if the circuit breaker is enabled, false otherwise
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Retrieves a circuit by name
   *
   * Returns the circuit instance if it exists, otherwise returns undefined.
   * This is primarily used for testing and debugging purposes.
   *
   * @param {string} name - Circuit identifier
   *
   * @returns {ICircuit | undefined} The circuit instance if found, undefined otherwise
   */
  public get(name: string): ICircuit | undefined {
    return this.circuits.get(name);
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
        return this.canProceedInOpenState(circuit);
      case CircuitState.HALF_OPEN:
        return this.canProceedInHalfOpenState(circuit);
      case CircuitState.CLOSED:
      default:
        return this.canProceedInClosedState();
    }
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
  public canProceedOrFail(name: string): boolean {
    const canProceed = this.canProceed(name);

    if (!canProceed) {
      throw new CircuitBreakerException({
        name,
        message: 'Circuit breaker is open',
      });
    }

    return true;
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

    this.loggingService.info({
      type: LogType.CircuitBreakerRegistered,
      circuit: circuit.name,
      state: circuit.metrics.state,
      config: {
        failureThreshold: circuit.config.failureThreshold,
        successThreshold: circuit.config.successThreshold,
        timeout: circuit.config.timeout,
        rollingWindow: circuit.config.rollingWindow,
        halfOpenMaxRequests: circuit.config.halfOpenMaxRequests,
      },
      message: `Circuit "${circuit.name}" registered with initial state ${this.DEFAULT_STATE}`,
    });

    return circuit;
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
  private canProceedInOpenState(circuit: ICircuit): boolean {
    const now = Date.now();
    if (
      circuit.metrics.nextAttemptTime &&
      now >= circuit.metrics.nextAttemptTime
    ) {
      this.transitionToHalfOpen(circuit);

      return this.canProceedInHalfOpenState(circuit);
    }

    const timeUntilRetry = circuit.metrics.nextAttemptTime
      ? Math.ceil((circuit.metrics.nextAttemptTime - now) / 1000)
      : 0;

    this.loggingService.warn({
      type: LogType.CircuitBreakerRequestBlocked,
      circuit: circuit.name,
      state: CircuitState.OPEN,
      failureCount: circuit.metrics.failureCount,
      timeUntilRetrySeconds: timeUntilRetry,
      message: `Request blocked: Circuit "${circuit.name}" is OPEN. Retry in ${timeUntilRetry}s`,
    });

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

    this.loggingService.info({
      type: LogType.CircuitBreakerStateTransition,
      circuit: circuit.name,
      from: CircuitState.OPEN,
      to: CircuitState.HALF_OPEN,
      maxTestRequests: circuit.config.halfOpenMaxRequests,
      message: `Circuit "${circuit.name}" transitioned from OPEN to HALF_OPEN. Allowing ${circuit.config.halfOpenMaxRequests} test requests`,
    });
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
  private canProceedInHalfOpenState(circuit: ICircuit): boolean {
    if (
      circuit.metrics.halfOpenRequestCounts < circuit.config.halfOpenMaxRequests
    ) {
      circuit.metrics.halfOpenRequestCounts++;

      this.loggingService.debug({
        type: LogType.CircuitBreakerHalfOpenRequest,
        circuit: circuit.name,
        state: CircuitState.HALF_OPEN,
        testRequestNumber: circuit.metrics.halfOpenRequestCounts,
        maxTestRequests: circuit.config.halfOpenMaxRequests,
        message: `Circuit "${circuit.name}" allowing test request ${circuit.metrics.halfOpenRequestCounts}/${circuit.config.halfOpenMaxRequests} in HALF_OPEN state`,
      });

      return true;
    }

    this.loggingService.warn({
      type: LogType.CircuitBreakerRequestBlocked,
      circuit: circuit.name,
      state: CircuitState.HALF_OPEN,
      reason: 'Max test requests reached',
      message: `Request blocked: Circuit "${circuit.name}" is HALF_OPEN and max test requests (${circuit.config.halfOpenMaxRequests}) reached`,
    });

    return false;
  }

  /**
   * Handles circuit logic for default state
   *
   * In default state, all requests are allowed through.
   *
   * @returns {boolean} Always returns true (requests allowed)
   */
  private canProceedInClosedState(): boolean {
    return true;
  }

  /**
   * Records a successful request for the circuit
   *
   * Only processes success if circuit is being tracked (has had failures).
   * Updates success metrics and handles state transitions:
   * - In HALF_OPEN: Transitions to CLOSED when the success threshold is reached and removes the circuit from memory
   *
   * @param {string} name - Circuit identifier
   *
   * @returns {void}
   */
  public recordSuccess(name: string): void {
    const circuit = this.circuits.get(name);
    if (!circuit) {
      return;
    }

    circuit.metrics.successCount++;
    circuit.metrics.consecutiveSuccesses++;

    this.loggingService.debug({
      type: LogType.CircuitBreakerSuccessRecorded,
      circuit: circuit.name,
      state: circuit.metrics.state,
      consecutiveSuccesses: circuit.metrics.consecutiveSuccesses,
      successThreshold: circuit.config.successThreshold,
      message: `Success recorded for circuit "${circuit.name}" (${circuit.metrics.consecutiveSuccesses}/${circuit.config.successThreshold} consecutive successes)`,
    });

    if (circuit.metrics.state === CircuitState.HALF_OPEN) {
      if (
        circuit.metrics.consecutiveSuccesses >= circuit.config.successThreshold
      ) {
        this.transitionToClosed(circuit);
      }
    }
  }

  /**
   * Transitions a circuit to CLOSED state and removes it from memory
   *
   * This happens when the circuit successfully recovers in HALF_OPEN state.
   * The circuit is removed to prevent memory exhaustion and will be
   * recreated if failures occur again.
   *
   * @param {ICircuit} circuit - Circuit instance
   * @returns {void}
   */
  private transitionToClosed(circuit: ICircuit): void {
    this.loggingService.info({
      type: LogType.CircuitBreakerStateTransition,
      circuit: circuit.name,
      from: CircuitState.HALF_OPEN,
      to: CircuitState.CLOSED,
      totalSuccesses: circuit.metrics.successCount,
      totalFailures: circuit.metrics.failureCount,
      message: `Circuit "${circuit.name}" transitioned from HALF_OPEN to CLOSED. Service recovered successfully`,
    });

    this.removeCircuit(circuit);
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
   * @param {ICircuit} circuit - Circuit instance
   *
   * @returns {void}
   */
  public recordFailure(circuit: ICircuit): void {
    const now = Date.now();

    this.discardOldFailures(circuit, now);

    circuit.metrics.failureCount++;
    circuit.metrics.lastFailureTime = now;
    circuit.metrics.consecutiveSuccesses = 0;

    this.loggingService.warn({
      type: LogType.CircuitBreakerFailureRecorded,
      circuit: circuit.name,
      state: circuit.metrics.state,
      failureCount: circuit.metrics.failureCount,
      failureThreshold: circuit.config.failureThreshold,
      message: `Failure recorded for circuit "${circuit.name}" (${circuit.metrics.failureCount}/${circuit.config.failureThreshold} failures in rolling window)`,
    });

    if (
      circuit.metrics.state === CircuitState.HALF_OPEN ||
      (circuit.metrics.state === CircuitState.CLOSED &&
        circuit.metrics.failureCount >= circuit.config.failureThreshold) // if CLOSED And failure count exceeds threshold
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
      const oldFailureCount = circuit.metrics.failureCount;
      circuit.metrics.failureCount = 0;

      if (oldFailureCount > 0) {
        this.loggingService.debug({
          type: LogType.CircuitBreakerFailuresDiscarded,
          circuit: circuit.name,
          state: circuit.metrics.state,
          discardedFailures: oldFailureCount,
          rollingWindowMs: circuit.config.rollingWindow,
          message: `Discarded ${oldFailureCount} old failure(s) for circuit "${circuit.name}" (outside rolling window)`,
        });
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
   * @param {ICircuit} circuit - Circuit instance
   * @returns {void}
   */
  private transitionToOpen(circuit: ICircuit): void {
    const previousState = circuit.metrics.state;
    circuit.metrics.state = CircuitState.OPEN;
    circuit.metrics.nextAttemptTime = Date.now() + circuit.config.timeout;

    const timeoutSeconds = Math.ceil(circuit.config.timeout / 1000);

    this.loggingService.error({
      type: LogType.CircuitBreakerStateTransition,
      circuit: circuit.name,
      from: previousState,
      to: CircuitState.OPEN,
      failureCount: circuit.metrics.failureCount,
      failureThreshold: circuit.config.failureThreshold,
      timeoutSeconds: timeoutSeconds,
      nextAttemptTime: new Date(circuit.metrics.nextAttemptTime).toISOString(),
      message: `Circuit "${circuit.name}" transitioned from ${previousState} to OPEN. Failure threshold reached (${circuit.metrics.failureCount}/${circuit.config.failureThreshold}). Will retry in ${timeoutSeconds}s`,
    });
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

  /**
   * Periodically cleans up stale circuits to prevent memory leaks
   *
   * @returns {void}
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  public cleanupStaleCircuits(): void {
    const circuitCount = this.circuits.size;
    const staleCircuits: Array<string> = [];

    this.circuits.forEach((circuit: ICircuit): void => {
      if (this.isStale(circuit)) {
        staleCircuits.push(circuit.name);
        this.removeCircuit(circuit);
      }
    });

    if (staleCircuits.length > 0) {
      this.loggingService.info({
        type: LogType.CircuitBreakerCleanup,
        totalCircuits: circuitCount,
        staleCircuitsRemoved: staleCircuits.length,
        remainingCircuits: this.circuits.size,
        removedCircuits: staleCircuits,
        message: `Cleaned up ${staleCircuits.length} stale circuit(s): ${staleCircuits.join(', ')}`,
      });
    } else {
      this.loggingService.debug({
        type: LogType.CircuitBreakerCleanup,
        totalCircuits: circuitCount,
        staleCircuitsRemoved: 0,
        message: `Circuit cleanup ran: no stale circuits found (${circuitCount} active)`,
      });
    }
  }

  /**
   * Determines if a circuit is stale and should be cleaned up
   *
   * A circuit is considered stale if:
   * - it's in CLOSED state and hasn't had any failures for a threshold factor times the rolling window duration
   * - it's in OPEN state and the next attempt time has already passed. This helps prevent
   *
   * This helps prevent stale circuits from being removed prematurely.
   *
   * This helps prevent memory leaks by removing unused circuits.
   *
   * @param {ICircuit} circuit - The circuit to check for staleness
   *
   * @returns {boolean} True if the circuit is stale and should be removed
   */
  private isStale(circuit: ICircuit): boolean {
    const now = Date.now();
    if (!circuit.metrics.lastFailureTime) {
      return false;
    }

    const timeSinceLastFailure = now - circuit.metrics.lastFailureTime;
    const staleRollingWindow =
      circuit.config.rollingWindow * this.STALE_BUFFER_FACTOR;

    const staleNextAttemptTime = circuit.metrics.nextAttemptTime
      ? circuit.metrics.nextAttemptTime +
        circuit.config.timeout * this.STALE_BUFFER_FACTOR
      : undefined;

    const isWaitingForNextAttempt =
      circuit.metrics.state === CircuitState.OPEN &&
      staleNextAttemptTime &&
      now < staleNextAttemptTime;

    return timeSinceLastFailure > staleRollingWindow && !isWaitingForNextAttempt
      ? true
      : false;
  }
}
