// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { Mocked, MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { CircuitBreakerService } from '@/datasources/circuit-breaker/circuit-breaker.service';
import { CircuitState } from '@/datasources/circuit-breaker/enums/circuit-state.enum';
import { CircuitBreakerException } from '@/datasources/circuit-breaker/exceptions/circuit-breaker.exception';
import type { ICircuit } from '@/datasources/circuit-breaker/interfaces/circuit-breaker.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import type { ILoggingService } from '@/logging/logging.interface';

describe('CircuitBreakerService', () => {
  let mockLoggingService: MockedObject<ILoggingService>;
  const circuitName = faker.string.alphanumeric();

  beforeEach(() => {
    vi.useFakeTimers();
    mockLoggingService = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    } as MockedObject<ILoggingService>;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createService(overrides?: {
    enabled?: boolean;
    threshold?: number;
    timeout?: number;
    rollingWindow?: number;
    halfOpenThresholdPercent?: number;
  }): CircuitBreakerService {
    const config: Record<string, number | boolean> = {
      'circuitBreaker.enabled': overrides?.enabled ?? true,
      'circuitBreaker.threshold':
        overrides?.threshold ?? faker.number.int({ min: 1, max: 10 }),
      'circuitBreaker.timeout':
        overrides?.timeout ?? faker.number.int({ min: 10_000, max: 120_000 }),
      'circuitBreaker.rollingWindow':
        overrides?.rollingWindow ??
        faker.number.int({ min: 60_000, max: 300_000 }),
      'circuitBreaker.halfOpenThresholdPercent':
        overrides?.halfOpenThresholdPercent ??
        faker.number.int({ min: 10, max: 100 }),
    };
    const mockConfigService = {
      getOrThrow: vi.fn((key: string) => config[key]),
    } as unknown as Mocked<IConfigurationService>;

    return new CircuitBreakerService(mockConfigService, mockLoggingService);
  }

  /**
   * Circuits are only registered on their first failure, so tests seed one
   * by recording a failure and then reading it back.
   */
  function getRegisteredCircuit(
    service: CircuitBreakerService,
    name: string,
  ): ICircuit {
    const circuit = service.get(name);
    if (!circuit) {
      throw new Error(`Circuit "${name}" was not registered`);
    }
    return circuit;
  }

  describe('Circuit Registration', () => {
    it('should register a circuit on its first failure', () => {
      const service = createService({ threshold: 2 });
      expect(service.get(circuitName)).toBeUndefined();

      service.recordFailure(circuitName);

      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.name).toBe(circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.CLOSED);
      expect(circuit.metrics.failureCount).toBe(1);
      expect(mockLoggingService.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LogType.CircuitBreakerRegistered,
          circuit: circuitName,
        }),
      );
    });

    it('should reuse the existing circuit on subsequent failures', () => {
      const service = createService({ threshold: 3 });

      service.recordFailure(circuitName);
      service.recordFailure(circuitName);

      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.metrics.failureCount).toBe(2);
      expect(mockLoggingService.info).toHaveBeenCalledTimes(1);
    });

    it('should not register a circuit when disabled', () => {
      const service = createService({ enabled: false });

      service.recordFailure(circuitName);

      expect(service.get(circuitName)).toBeUndefined();
      expect(mockLoggingService.info).not.toHaveBeenCalled();
    });
  });

  describe('CLOSED State', () => {
    it('should start in CLOSED state', () => {
      const service = createService({ threshold: 2 });
      service.recordFailure(circuitName);
      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.CLOSED);
    });

    it('should allow requests in CLOSED state', () => {
      const service = createService({ threshold: 2 });
      service.recordFailure(circuitName);
      expect(service.canProceed(circuitName)).toBe(true);
    });

    it('should transition to OPEN after threshold failures', () => {
      const service = createService({ threshold: 3 });

      service.recordFailure(circuitName);
      service.recordFailure(circuitName);
      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.CLOSED);

      service.recordFailure(circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.OPEN);
    });

    it('should not increment consecutive successes in CLOSED state', () => {
      const service = createService({ threshold: 3 });
      service.recordFailure(circuitName);
      const circuit = getRegisteredCircuit(service, circuitName);

      service.recordSuccess(circuitName);
      service.recordSuccess(circuitName);
      expect(circuit.metrics.consecutiveSuccesses).toBe(0);
    });
  });

  describe('OPEN State', () => {
    it('should block requests in OPEN state', () => {
      const service = createService({ threshold: 2 });
      service.recordFailure(circuitName);
      service.recordFailure(circuitName);

      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.OPEN);
      expect(service.canProceed(circuitName)).toBe(false);
    });

    it('should transition to HALF_OPEN after timeout', () => {
      const service = createService({ threshold: 2, timeout: 1000 });
      service.recordFailure(circuitName);
      service.recordFailure(circuitName);
      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.OPEN);

      vi.advanceTimersByTime(1100);
      expect(service.canProceed(circuitName)).toBe(true);
      const updatedCircuit = service.get(circuitName);
      expect(updatedCircuit?.metrics.state).toBe(CircuitState.HALF_OPEN);
    });

    it('should not allow requests before timeout', () => {
      const service = createService({ threshold: 2, timeout: 1000 });
      service.recordFailure(circuitName);
      service.recordFailure(circuitName);

      expect(service.canProceed(circuitName)).toBe(false);

      vi.advanceTimersByTime(500);
      expect(service.canProceed(circuitName)).toBe(false);
      const c = service.get(circuitName);
      expect(c?.metrics.state).toBe(CircuitState.OPEN);
    });
  });

  describe('HALF_OPEN State', () => {
    // threshold=5, halfOpenThresholdPercent=40
    // → effective HALF_OPEN threshold = ceil(5 * 40 / 100) = 2, which is
    //   the failure count that re-opens, the consecutive successes that
    //   close, and the max concurrent probes alike
    function createHalfOpenService(
      halfOpenThresholdPercent = 40,
      threshold = 5,
    ): CircuitBreakerService {
      const svc = createService({
        threshold,
        timeout: 100,
        halfOpenThresholdPercent,
      });
      for (let i = 0; i < threshold; i++) {
        svc.recordFailure(circuitName);
      }
      return svc;
    }

    it('should admit the transitioning request as the first probe', () => {
      const service = createHalfOpenService();
      vi.advanceTimersByTime(150);
      expect(service.canProceed(circuitName)).toBe(true);
      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.HALF_OPEN);
      expect(circuit.metrics.halfOpenInFlight).toBe(1);
    });

    it('should admit at most as many concurrent probes as failures needed to reopen', () => {
      // With threshold 5, a rate of maxInFlight * 20 % yields exactly maxInFlight
      const maxInFlight = faker.number.int({ min: 1, max: 5 });
      const service = createHalfOpenService(maxInFlight * 20);
      vi.advanceTimersByTime(150);
      for (let i = 0; i < maxInFlight; i++) {
        expect(service.canProceed(circuitName)).toBe(true);
      }
      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.metrics.halfOpenInFlight).toBe(maxInFlight);

      expect(service.canProceed(circuitName)).toBe(false);
      expect(() => service.canProceedOrFail(circuitName)).toThrow(
        CircuitBreakerException,
      );
      expect(circuit.metrics.state).toBe(CircuitState.HALF_OPEN);
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LogType.CircuitBreakerRequestBlocked,
          state: CircuitState.HALF_OPEN,
          inFlight: maxInFlight,
          maxInFlight,
        }),
      );
    });

    it('should free a probe slot when the probe succeeds', () => {
      const service = createHalfOpenService();
      vi.advanceTimersByTime(150);
      expect(service.canProceed(circuitName)).toBe(true);
      expect(service.canProceed(circuitName)).toBe(true);
      expect(service.canProceed(circuitName)).toBe(false);

      service.recordSuccess(circuitName);
      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.HALF_OPEN);
      expect(circuit.metrics.halfOpenInFlight).toBe(1);
      expect(service.canProceed(circuitName)).toBe(true);
    });

    it('should free a probe slot when the probe fails', () => {
      // Two slots and two failures to reopen, so one failure frees a slot
      // while the circuit stays HALF_OPEN
      const service = createHalfOpenService();
      vi.advanceTimersByTime(150);
      expect(service.canProceed(circuitName)).toBe(true);
      expect(service.canProceed(circuitName)).toBe(true);
      expect(service.canProceed(circuitName)).toBe(false);

      service.recordFailure(circuitName);
      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.HALF_OPEN);
      expect(circuit.metrics.halfOpenInFlight).toBe(1);
      expect(service.canProceed(circuitName)).toBe(true);
    });

    it('should reset in-flight probes when reopening', () => {
      const service = createHalfOpenService();
      vi.advanceTimersByTime(150);
      expect(service.canProceed(circuitName)).toBe(true);
      expect(service.canProceed(circuitName)).toBe(true);

      service.recordFailure(circuitName);
      service.recordFailure(circuitName);
      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.OPEN);
      expect(circuit.metrics.halfOpenInFlight).toBe(0);
    });

    it('should transition to CLOSED after consecutive successes', () => {
      const service = createHalfOpenService();
      vi.advanceTimersByTime(150);
      service.canProceed(circuitName); // Transition to HALF_OPEN
      const circuit = getRegisteredCircuit(service, circuitName);

      // Effective threshold = ceil(5 * 40 / 100) = 2
      service.recordSuccess(circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.HALF_OPEN);

      service.recordSuccess(circuitName);
      expect(service.get(circuitName)).toBeUndefined();
    });

    it('should need no more successes to close than failures to re-open', () => {
      const threshold = faker.number.int({ min: 2, max: 10 });
      const halfOpenThresholdPercent = faker.number.int({
        min: 10,
        max: 100,
      });
      const effective = Math.ceil((threshold * halfOpenThresholdPercent) / 100);
      const halfOpenService = (): CircuitBreakerService => {
        const svc = createHalfOpenService(halfOpenThresholdPercent, threshold);
        vi.advanceTimersByTime(150);
        svc.canProceed(circuitName);
        return svc;
      };

      const closing = halfOpenService();
      for (let i = 0; i < effective - 1; i++) {
        closing.recordSuccess(circuitName);
        expect(getRegisteredCircuit(closing, circuitName).metrics.state).toBe(
          CircuitState.HALF_OPEN,
        );
      }
      closing.recordSuccess(circuitName);
      expect(closing.get(circuitName)).toBeUndefined();

      const reopening = halfOpenService();
      for (let i = 0; i < effective - 1; i++) {
        reopening.recordFailure(circuitName);
        expect(getRegisteredCircuit(reopening, circuitName).metrics.state).toBe(
          CircuitState.HALF_OPEN,
        );
      }
      reopening.recordFailure(circuitName);
      expect(getRegisteredCircuit(reopening, circuitName).metrics.state).toBe(
        CircuitState.OPEN,
      );
    });

    it('should transition back to OPEN when half-open failure threshold is reached', () => {
      const service = createHalfOpenService();
      vi.advanceTimersByTime(150);
      service.canProceed(circuitName); // Transition to HALF_OPEN
      const circuit = getRegisteredCircuit(service, circuitName);

      // Effective threshold = ceil(5 * 40 / 100) = 2
      service.recordFailure(circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.HALF_OPEN);

      service.recordFailure(circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.OPEN);
    });
  });

  describe('OPEN state ignores late failures', () => {
    it('should not record failures when circuit is already OPEN', () => {
      const service = createService({ threshold: 3 });

      service.recordFailure(circuitName);
      service.recordFailure(circuitName);
      service.recordFailure(circuitName);
      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.OPEN);
      expect(circuit.metrics.failureCount).toBe(3);

      // Simulate late-arriving in-flight failures
      service.recordFailure(circuitName);
      service.recordFailure(circuitName);

      // Count should stay at 3 — not inflate to 5
      expect(circuit.metrics.failureCount).toBe(3);
    });

    it('should keep failure count exactly at threshold', () => {
      const threshold = 5;
      const service = createService({ threshold });

      for (let i = 0; i < threshold + 10; i++) {
        service.recordFailure(circuitName);
      }

      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.OPEN);
      expect(circuit.metrics.failureCount).toBe(threshold);
    });
  });

  describe('Metrics', () => {
    it('should track failure count', () => {
      const service = createService({ threshold: 10 });

      service.recordFailure(circuitName);
      service.recordFailure(circuitName);

      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.metrics.failureCount).toBe(2);
    });

    it('should track consecutive successes in HALF_OPEN state', () => {
      // Any rate above 40 % of threshold 5 needs three or more successes to
      // close, so the two recorded below accumulate without closing the circuit
      const service = createService({
        threshold: 5,
        timeout: 100,
        halfOpenThresholdPercent: faker.number.int({ min: 41, max: 100 }),
      });

      for (let i = 0; i < 5; i++) {
        service.recordFailure(circuitName);
      }
      const circuit = getRegisteredCircuit(service, circuitName);

      vi.advanceTimersByTime(150);
      service.canProceed(circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.HALF_OPEN);

      service.recordSuccess(circuitName);
      service.recordSuccess(circuitName);
      expect(circuit.metrics.consecutiveSuccesses).toBe(2);

      service.recordFailure(circuitName);
      expect(circuit.metrics.consecutiveSuccesses).toBe(0);
    });
  });

  describe('Rolling Window', () => {
    it('should discard old failures outside the rolling window', () => {
      const rollingWindow = 100;
      const service = createService({
        threshold: 5,
        rollingWindow,
      });

      service.recordFailure(circuitName);
      service.recordFailure(circuitName);
      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.metrics.failureCount).toBe(2);

      // Advance time past rolling window
      vi.advanceTimersByTime(rollingWindow + 1);

      service.recordFailure(circuitName);
      // Old failures discarded, only the new one counts
      expect(circuit.metrics.failureCount).toBe(1);
    });
  });

  describe('Delete', () => {
    it('should delete a single circuit', () => {
      const service = createService();

      service.recordFailure(circuitName);
      service.recordFailure(circuitName);
      expect(service.get(circuitName)).toBeDefined();

      service.delete(circuitName);
      expect(service.get(circuitName)).toBeUndefined();
    });

    it('should delete all circuits', () => {
      const service = createService();

      service.recordFailure('circuit-1');
      service.recordFailure('circuit-2');
      expect(service.get('circuit-1')).toBeDefined();
      expect(service.get('circuit-2')).toBeDefined();

      service.deleteAll();

      expect(service.get('circuit-1')).toBeUndefined();
      expect(service.get('circuit-2')).toBeUndefined();
    });
  });

  describe('Cleanup', () => {
    it('should remove stale circuits', () => {
      const rollingWindow = 100;
      const service = createService({
        threshold: 3,
        rollingWindow,
        timeout: 50,
      });

      // Record a failure to register the circuit and set lastActivityTime
      service.recordFailure(circuitName);
      expect(service.get(circuitName)).toBeDefined();

      // Advance time past the stale window (rollingWindow * 10)
      const pastStaleWindow = faker.number.int({ min: 11, max: 100 });
      vi.advanceTimersByTime(rollingWindow * pastStaleWindow);

      service.cleanupStaleCircuits();
      expect(service.get(circuitName)).toBeUndefined();
    });

    it('should not remove circuits still waiting for retry', () => {
      const service = createService({
        threshold: 2,
        timeout: 10_000,
        rollingWindow: 100,
      });

      // Trip the circuit to OPEN
      service.recordFailure(circuitName);
      service.recordFailure(circuitName);
      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.OPEN);

      // Advance time past rolling window but within timeout buffer
      vi.advanceTimersByTime(500);

      service.cleanupStaleCircuits();
      expect(service.get(circuitName)).toBeDefined();
    });
  });

  describe('Auto-create Circuit', () => {
    it('should allow requests when circuit does not exist', () => {
      const service = createService();
      expect(service.canProceed('new-circuit')).toBe(true);
    });

    it('should not auto-create circuit on canProceed', () => {
      const service = createService();
      service.canProceed('new-circuit');
      expect(service.get('new-circuit')).toBeUndefined();
    });

    it('should not auto-create circuit on recordSuccess', () => {
      const service = createService();
      service.recordSuccess('new-circuit');
      expect(service.get('new-circuit')).toBeUndefined();
    });
  });

  describe('canProceedOrFail', () => {
    it('should not throw when circuit does not exist', () => {
      const service = createService();
      expect(() => service.canProceedOrFail('new-circuit')).not.toThrow();
    });

    it('should not throw when circuit is CLOSED', () => {
      const service = createService({ threshold: 5 });
      service.recordFailure(circuitName);
      expect(() => service.canProceedOrFail(circuitName)).not.toThrow();
    });

    it('should throw CircuitBreakerException when circuit is OPEN', () => {
      const service = createService({ threshold: 2 });
      service.recordFailure(circuitName);
      service.recordFailure(circuitName);

      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.OPEN);
      expect(() => service.canProceedOrFail(circuitName)).toThrow(
        CircuitBreakerException,
      );
    });
  });

  describe('Enabled/Disabled', () => {
    it('should enforce circuit breaker logic when enabled', () => {
      const threshold = faker.number.int({ min: 1, max: 10 });
      const service = createService({ threshold });

      expect(service.canProceed(circuitName)).toBe(true);

      for (let i = 0; i < threshold; i++) {
        service.recordFailure(circuitName);
      }

      const circuit = getRegisteredCircuit(service, circuitName);
      expect(circuit.metrics.state).toBe(CircuitState.OPEN);
      expect(service.canProceed(circuitName)).toBe(false);
    });

    it('should bypass circuit breaker logic when disabled', () => {
      const threshold = faker.number.int({ min: 1, max: 10 });
      const service = createService({ enabled: false, threshold });

      for (let i = 0; i < threshold; i++) {
        service.recordFailure(circuitName);
      }
      service.recordSuccess(circuitName);

      expect(service.get(circuitName)).toBeUndefined();
      expect(service.canProceed(circuitName)).toBe(true);
      expect(() => service.canProceedOrFail(circuitName)).not.toThrow();
      expect(mockLoggingService.info).not.toHaveBeenCalled();
      expect(mockLoggingService.warn).not.toHaveBeenCalled();
      expect(mockLoggingService.error).not.toHaveBeenCalled();
    });
  });
});
