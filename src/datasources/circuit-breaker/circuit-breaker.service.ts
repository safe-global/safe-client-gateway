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
  private readonly STALE_MULTIPLIER: number = 10;

  private readonly enabled: boolean;
  private readonly config: ICircuitConfig;
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
    this.config = {
      threshold: this.configurationService.getOrThrow<number>(
        'circuitBreaker.threshold',
      ),
      timeout: this.configurationService.getOrThrow<number>(
        'circuitBreaker.timeout',
      ),
      rollingWindow: this.configurationService.getOrThrow<number>(
        'circuitBreaker.rollingWindow',
      ),
      halfOpenFailureRateThreshold:
        this.configurationService.getOrThrow<number>(
          'circuitBreaker.halfOpenFailureRateThreshold',
        ),
    };
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

    if (!this.enabled || !circuit) {
      return true;
    }

    if (circuit.metrics.state === CircuitState.OPEN) {
      return this.canProceedInOpenState(circuit);
    }

    return true;
  }

  /**
   * Checks if a request can proceed, throws if circuit is open
   *
   * @param {string} name - Circuit identifier
   * @throws {CircuitBreakerException} If circuit is open
   */
  public canProceedOrFail(name: string): void {
    if (!this.canProceed(name)) {
      throw new CircuitBreakerException();
    }
  }

  /**
   * Gets an existing circuit or registers a new one if it doesn't exist
   *
   * @param {string} name - Unique identifier for the circuit
   *
   * @returns {ICircuit} The circuit instance for the given name
   */
  public getOrRegisterCircuit(name: string): ICircuit {
    const existing = this.circuits.get(name);
    if (existing) {
      return existing;
    }

    const circuit: ICircuit = {
      name,
      metrics: {
        failureCount: 0,
        consecutiveSuccesses: 0,
        state: CircuitState.CLOSED,
        lastFailureTime: undefined,
        lastActivityTime: undefined,
        nextAttemptTime: undefined,
      },
    };

    this.circuits.set(name, circuit);

    this.loggingService.info({
      type: LogType.CircuitBreakerRegistered,
      circuit: circuit.name,
      state: circuit.metrics.state,
      message: `Circuit "${circuit.name}" registered`,
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

      return true;
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
    circuit.metrics.failureCount = 0;
    circuit.metrics.state = CircuitState.HALF_OPEN;

    this.loggingService.info({
      type: LogType.CircuitBreakerStateTransition,
      circuit: circuit.name,
      from: CircuitState.OPEN,
      to: CircuitState.HALF_OPEN,
      message: `Circuit "${circuit.name}" transitioned from OPEN to HALF_OPEN`,
    });
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

    circuit.metrics.lastActivityTime = Date.now();

    if (circuit.metrics.state === CircuitState.HALF_OPEN) {
      circuit.metrics.consecutiveSuccesses++;

      this.loggingService.debug({
        type: LogType.CircuitBreakerSuccessRecorded,
        circuit: circuit.name,
        state: circuit.metrics.state,
        consecutiveSuccesses: circuit.metrics.consecutiveSuccesses,
        threshold: this.config.threshold,
        message: `Success recorded for circuit "${circuit.name}" (${circuit.metrics.consecutiveSuccesses}/${this.config.threshold} consecutive successes)`,
      });

      if (circuit.metrics.consecutiveSuccesses >= this.config.threshold) {
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
      totalFailures: circuit.metrics.failureCount,
      message: `Circuit "${circuit.name}" transitioned from HALF_OPEN to CLOSED. Service recovered successfully`,
    });

    this.circuits.delete(circuit.name);
  }

  /**
   * Returns the failure threshold for the current circuit state
   *
   * In HALF_OPEN state, uses a percentage of the full threshold to
   * allow faster detection of still-failing services.
   *
   * @param {ICircuit} circuit - Circuit instance
   * @returns {number} The effective failure threshold
   */
  private getEffectiveFailureThreshold(circuit: ICircuit): number {
    if (circuit.metrics.state === CircuitState.HALF_OPEN) {
      return Math.ceil(
        (this.config.threshold * this.config.halfOpenFailureRateThreshold) /
          100,
      );
    }
    return this.config.threshold;
  }

  /**
   * Records a failed request for the circuit
   *
   * Updates failure metrics and handles state transitions:
   * - In HALF_OPEN: Reopens the circuit when the effective threshold is reached
   * - In CLOSED: Opens circuit if failure threshold is exceeded
   *
   * @param {string} name - Circuit identifier
   *
   * @returns {void}
   */
  public recordFailure(name: string): void {
    const circuit = this.circuits.get(name);
    if (
      !this.enabled ||
      !circuit ||
      circuit.metrics.state === CircuitState.OPEN
    ) {
      return;
    }

    const now = Date.now();

    if (circuit.metrics.state !== CircuitState.HALF_OPEN) {
      this.discardOldFailures(circuit, now);
    }

    circuit.metrics.failureCount++;
    circuit.metrics.lastFailureTime = now;
    circuit.metrics.lastActivityTime = now;
    circuit.metrics.consecutiveSuccesses = 0;

    const effectiveThreshold = this.getEffectiveFailureThreshold(circuit);

    this.loggingService.warn({
      type: LogType.CircuitBreakerFailureRecorded,
      circuit: circuit.name,
      state: circuit.metrics.state,
      failureCount: circuit.metrics.failureCount,
      threshold: effectiveThreshold,
      message: `Failure recorded for circuit "${circuit.name}" (${circuit.metrics.failureCount}/${effectiveThreshold} failures in rolling window)`,
    });

    if (circuit.metrics.failureCount >= effectiveThreshold) {
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
        this.config.rollingWindow
    ) {
      const discarded = circuit.metrics.failureCount;
      circuit.metrics.failureCount = 0;

      this.loggingService.debug({
        type: LogType.CircuitBreakerFailuresDiscarded,
        circuit: circuit.name,
        state: circuit.metrics.state,
        discardedFailures: discarded,
        rollingWindowMs: this.config.rollingWindow,
        message: `Discarded ${discarded} old failure(s) for circuit "${circuit.name}" (outside rolling window)`,
      });
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
    const effectiveThreshold = this.getEffectiveFailureThreshold(circuit);
    circuit.metrics.state = CircuitState.OPEN;
    circuit.metrics.nextAttemptTime = Date.now() + this.config.timeout;

    const timeoutSeconds = Math.ceil(this.config.timeout / 1000);

    this.loggingService.error({
      type: LogType.CircuitBreakerStateTransition,
      circuit: circuit.name,
      from: previousState,
      to: CircuitState.OPEN,
      failureCount: circuit.metrics.failureCount,
      threshold: effectiveThreshold,
      timeoutSeconds: timeoutSeconds,
      nextAttemptTime: new Date(circuit.metrics.nextAttemptTime).toISOString(),
      message: `Circuit "${circuit.name}" transitioned from ${previousState} to OPEN. Threshold reached (${circuit.metrics.failureCount}/${effectiveThreshold}). Will retry in ${timeoutSeconds}s`,
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
    const totalBefore = this.circuits.size;
    let removed = 0;

    for (const [name, circuit] of this.circuits) {
      if (this.isStale(circuit)) {
        this.circuits.delete(name);
        removed++;
      }
    }

    if (removed > 0) {
      this.loggingService.info({
        type: LogType.CircuitBreakerCleanup,
        totalCircuits: totalBefore,
        staleCircuitsRemoved: removed,
        remainingCircuits: this.circuits.size,
        message: `Cleaned up ${removed} stale circuit(s)`,
      });
    }
  }

  /**
   * Determines if a circuit is stale and should be cleaned up
   *
   * A circuit is stale if its last failure is outside the rolling window
   * and it's not an OPEN circuit still waiting for its retry timeout.
   *
   * @param {ICircuit} circuit - The circuit to check for staleness
   * @returns {boolean} True if the circuit is stale and should be removed
   */
  private isStale(circuit: ICircuit): boolean {
    if (!circuit.metrics.lastActivityTime) {
      return true;
    }

    const timeSinceLastActivity = Date.now() - circuit.metrics.lastActivityTime;

    return (
      timeSinceLastActivity > this.config.rollingWindow * this.STALE_MULTIPLIER
    );
  }
}
