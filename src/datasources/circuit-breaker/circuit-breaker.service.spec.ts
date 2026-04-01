// SPDX-License-Identifier: FSL-1.1-MIT
import { CircuitBreakerService } from '@/datasources/circuit-breaker/circuit-breaker.service';
import { CircuitState } from '@/datasources/circuit-breaker/enums/circuit-state.enum';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';

describe('CircuitBreakerService', () => {
  let mockLoggingService: jest.MockedObjectDeep<ILoggingService>;

  beforeEach(() => {
    mockLoggingService = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as jest.MockedObjectDeep<ILoggingService>;
  });

  function createService(overrides?: {
    enabled?: boolean;
    threshold?: number;
    timeout?: number;
    rollingWindow?: number;
    halfOpenFailureRateThreshold?: number;
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
      'circuitBreaker.halfOpenFailureRateThreshold':
        overrides?.halfOpenFailureRateThreshold ??
        faker.number.int({ min: 10, max: 100 }),
    };
    const mockConfigService = {
      getOrThrow: jest.fn((key: string) => config[key]),
    } as unknown as jest.Mocked<IConfigurationService>;

    return new CircuitBreakerService(mockConfigService, mockLoggingService);
  }

  describe('Circuit Registration', () => {
    it('should register a new circuit', () => {
      const service = createService();
      const circuit = service.getOrRegisterCircuit('test-circuit');
      expect(circuit).toBeDefined();
      expect(circuit.name).toBe('test-circuit');
      expect(circuit.metrics.state).toBe(CircuitState.CLOSED);
    });

    it('should not overwrite existing circuit on re-registration', () => {
      const service = createService();
      const circuit = service.getOrRegisterCircuit('test-circuit');
      service.recordFailure(circuit.name);

      const sameCircuit = service.getOrRegisterCircuit('test-circuit');
      expect(sameCircuit.metrics.failureCount).toBe(1);
    });
  });

  describe('CLOSED State', () => {
    it('should start in CLOSED state', () => {
      const service = createService();
      const circuit = service.getOrRegisterCircuit('test-circuit');
      expect(circuit.metrics.state).toBe(CircuitState.CLOSED);
    });

    it('should allow requests in CLOSED state', () => {
      const service = createService();
      service.getOrRegisterCircuit('test-circuit');
      expect(service.canProceed('test-circuit')).toBe(true);
    });

    it('should transition to OPEN after threshold failures', () => {
      const service = createService({ threshold: 3 });
      const circuit = service.getOrRegisterCircuit('test-circuit');

      service.recordFailure(circuit.name);
      service.recordFailure(circuit.name);
      expect(circuit.metrics.state).toBe(CircuitState.CLOSED);

      service.recordFailure(circuit.name);
      expect(circuit.metrics.state).toBe(CircuitState.OPEN);
    });

    it('should reset consecutive successes on failure', () => {
      const service = createService({ threshold: 3 });
      const circuit = service.getOrRegisterCircuit('test-circuit');

      service.recordSuccess(circuit.name);
      service.recordSuccess(circuit.name);
      expect(circuit.metrics.consecutiveSuccesses).toBe(2);

      service.recordFailure(circuit.name);
      expect(circuit.metrics.consecutiveSuccesses).toBe(0);
    });
  });

  describe('OPEN State', () => {
    it('should block requests in OPEN state', () => {
      const service = createService({ threshold: 2 });
      const circuit = service.getOrRegisterCircuit('test-circuit');
      service.recordFailure(circuit.name);
      service.recordFailure(circuit.name);

      expect(circuit.metrics.state).toBe(CircuitState.OPEN);
      expect(service.canProceed('test-circuit')).toBe(false);
    });

    it('should transition to HALF_OPEN after timeout', (done) => {
      const service = createService({ threshold: 2, timeout: 1000 });
      const circuit = service.getOrRegisterCircuit('test-circuit');
      service.recordFailure(circuit.name);
      service.recordFailure(circuit.name);
      expect(circuit.metrics.state).toBe(CircuitState.OPEN);

      setTimeout(() => {
        expect(service.canProceed('test-circuit')).toBe(true);
        const updatedCircuit = service.get('test-circuit');
        expect(updatedCircuit?.metrics.state).toBe(CircuitState.HALF_OPEN);
        done();
      }, 1100);
    });

    it('should not allow requests before timeout', (done) => {
      const service = createService({ threshold: 2, timeout: 1000 });
      const circuit = service.getOrRegisterCircuit('test-circuit');
      service.recordFailure(circuit.name);
      service.recordFailure(circuit.name);

      expect(service.canProceed('test-circuit')).toBe(false);

      setTimeout(() => {
        expect(service.canProceed('test-circuit')).toBe(false);
        const c = service.get('test-circuit');
        expect(c?.metrics.state).toBe(CircuitState.OPEN);
        done();
      }, 500);
    });
  });

  describe('HALF_OPEN State', () => {
    // threshold=5, halfOpenFailureRateThreshold=40
    // → effective HALF_OPEN failure threshold = ceil(5 * 40 / 100) = 2
    // → consecutive successes to close = 5
    function createHalfOpenService(): CircuitBreakerService {
      const svc = createService({
        threshold: 5,
        timeout: 100,
        halfOpenFailureRateThreshold: 40,
      });
      const circuit = svc.getOrRegisterCircuit('test-circuit');
      for (let i = 0; i < 5; i++) {
        svc.recordFailure(circuit.name);
      }
      return svc;
    }

    it('should allow all requests in HALF_OPEN state', (done) => {
      const service = createHalfOpenService();
      setTimeout(() => {
        expect(service.canProceed('test-circuit')).toBe(true);
        const circuit = service.get('test-circuit');
        expect(circuit?.metrics.state).toBe(CircuitState.HALF_OPEN);

        expect(service.canProceed('test-circuit')).toBe(true);
        expect(service.canProceed('test-circuit')).toBe(true);
        expect(service.canProceed('test-circuit')).toBe(true);
        done();
      }, 150);
    });

    it('should transition to CLOSED after consecutive successes', (done) => {
      const service = createHalfOpenService();
      setTimeout(() => {
        service.canProceed('test-circuit'); // Transition to HALF_OPEN
        const circuit = service.get('test-circuit');
        expect(circuit).toBeDefined();

        if (circuit) {
          // Need 5 consecutive successes (threshold=5)
          for (let i = 0; i < 4; i++) {
            service.recordSuccess(circuit.name);
            expect(circuit.metrics.state).toBe(CircuitState.HALF_OPEN);
          }

          service.recordSuccess(circuit.name);
          expect(service.get('test-circuit')).toBeUndefined();
        }
        done();
      }, 150);
    });

    it('should transition back to OPEN when half-open failure threshold is reached', (done) => {
      const service = createHalfOpenService();
      setTimeout(() => {
        service.canProceed('test-circuit'); // Transition to HALF_OPEN
        const circuit = service.get('test-circuit');
        expect(circuit).toBeDefined();

        if (circuit) {
          // Effective threshold = ceil(5 * 40 / 100) = 2
          service.recordFailure(circuit.name);
          expect(circuit.metrics.state).toBe(CircuitState.HALF_OPEN);

          service.recordFailure(circuit.name);
          expect(circuit.metrics.state).toBe(CircuitState.OPEN);
        }
        done();
      }, 150);
    });
  });

  describe('OPEN state ignores late failures', () => {
    it('should not record failures when circuit is already OPEN', () => {
      const service = createService({ threshold: 3 });
      const circuit = service.getOrRegisterCircuit('test-circuit');

      service.recordFailure(circuit.name);
      service.recordFailure(circuit.name);
      service.recordFailure(circuit.name);
      expect(circuit.metrics.state).toBe(CircuitState.OPEN);
      expect(circuit.metrics.failureCount).toBe(3);

      // Simulate late-arriving in-flight failures
      service.recordFailure(circuit.name);
      service.recordFailure(circuit.name);

      // Count should stay at 3 — not inflate to 5
      expect(circuit.metrics.failureCount).toBe(3);
    });

    it('should keep failure count exactly at threshold', () => {
      const threshold = 5;
      const service = createService({ threshold });
      const circuit = service.getOrRegisterCircuit('test-circuit');

      for (let i = 0; i < threshold + 10; i++) {
        service.recordFailure(circuit.name);
      }

      expect(circuit.metrics.state).toBe(CircuitState.OPEN);
      expect(circuit.metrics.failureCount).toBe(threshold);
    });
  });

  describe('Metrics', () => {
    it('should track failure count', () => {
      const service = createService({ threshold: 10 });
      const circuit = service.getOrRegisterCircuit('test-circuit');

      service.recordFailure(circuit.name);
      service.recordFailure(circuit.name);

      expect(circuit.metrics.failureCount).toBe(2);
    });

    it('should track consecutive successes', () => {
      const service = createService();
      const circuit = service.getOrRegisterCircuit('test-circuit');

      service.recordSuccess(circuit.name);
      service.recordSuccess(circuit.name);
      service.recordFailure(circuit.name);
      service.recordSuccess(circuit.name);

      expect(circuit.metrics.consecutiveSuccesses).toBe(1);
    });
  });

  describe('Delete', () => {
    it('should delete a single circuit', () => {
      const service = createService();
      const circuit = service.getOrRegisterCircuit('test-circuit');

      service.recordFailure(circuit.name);
      service.recordFailure(circuit.name);

      service.delete('test-circuit');
      expect(service.get('test-circuit')).toBeUndefined();
    });

    it('should delete all circuits', () => {
      const service = createService();
      service.getOrRegisterCircuit('circuit-1');
      service.getOrRegisterCircuit('circuit-2');

      service.recordFailure('circuit-1');
      service.recordFailure('circuit-2');

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
      const circuit = service.getOrRegisterCircuit('test-circuit');

      // Record a failure to set lastFailureTime
      service.recordFailure(circuit.name);
      expect(service.get('test-circuit')).toBeDefined();

      // Advance time past the stale window (rollingWindow * 2)
      const original = Date.now;
      Date.now = jest.fn(() => original() + rollingWindow * 3);

      service.cleanupStaleCircuits();
      expect(service.get('test-circuit')).toBeUndefined();

      Date.now = original;
    });

    it('should not remove circuits still waiting for retry', () => {
      const service = createService({
        threshold: 2,
        timeout: 10_000,
        rollingWindow: 100,
      });
      const circuit = service.getOrRegisterCircuit('test-circuit');

      // Trip the circuit to OPEN
      service.recordFailure(circuit.name);
      service.recordFailure(circuit.name);
      expect(circuit.metrics.state).toBe(CircuitState.OPEN);

      // Advance time past rolling window but within timeout buffer
      const original = Date.now;
      Date.now = jest.fn(() => original() + 500);

      service.cleanupStaleCircuits();
      expect(service.get('test-circuit')).toBeDefined();

      Date.now = original;
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
  });

  describe('Enabled/Disabled', () => {
    it('should enforce circuit breaker logic when enabled', () => {
      const threshold = faker.number.int({ min: 1, max: 10 });
      const service = createService({ threshold });
      const circuit = service.getOrRegisterCircuit('test-circuit');

      expect(service.canProceed('test-circuit')).toBe(true);

      for (let i = 0; i < threshold; i++) {
        service.recordFailure(circuit.name);
      }

      expect(circuit.metrics.state).toBe(CircuitState.OPEN);
      expect(service.canProceed('test-circuit')).toBe(false);
    });

    it('should bypass circuit breaker logic when disabled', () => {
      const threshold = faker.number.int({ min: 1, max: 10 });
      const service = createService({ enabled: false, threshold });
      const circuit = service.getOrRegisterCircuit('test-circuit');

      for (let i = 0; i < threshold; i++) {
        service.recordFailure(circuit.name);
      }

      expect(circuit.metrics.state).toBe(CircuitState.CLOSED);
      expect(circuit.metrics.failureCount).toBe(0);
      expect(service.canProceed('test-circuit')).toBe(true);
    });
  });
});
