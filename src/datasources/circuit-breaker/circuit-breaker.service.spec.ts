// SPDX-License-Identifier: FSL-1.1-MIT
import { CircuitBreakerService } from '@/datasources/circuit-breaker/circuit-breaker.service';
import { CircuitState } from '@/datasources/circuit-breaker/enums/circuit-state.enum';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let mockConfigurationService: jest.Mocked<IConfigurationService>;
  let mockLoggingService: jest.MockedObjectDeep<ILoggingService>;
  let defaultFailureThreshold: number;
  let defaultSuccessThreshold: number;
  let defaultTimeout: number;
  let defaultRollingWindow: number;
  let defaultHalfOpenMaxRequests: number;

  beforeEach(() => {
    defaultFailureThreshold = faker.number.int({ min: 1, max: 10 });
    defaultSuccessThreshold = faker.number.int({ min: 1, max: 5 });
    defaultTimeout = faker.number.int({ min: 10_000, max: 120_000 });
    defaultRollingWindow = faker.number.int({ min: 60_000, max: 300_000 });
    defaultHalfOpenMaxRequests = faker.number.int({ min: 1, max: 10 });

    mockConfigurationService = {
      getOrThrow: jest.fn((key: string) => {
        const config: Record<string, number | boolean> = {
          'circuitBreaker.enabled': true,
          'circuitBreaker.failureThreshold': defaultFailureThreshold,
          'circuitBreaker.successThreshold': defaultSuccessThreshold,
          'circuitBreaker.timeout': defaultTimeout,
          'circuitBreaker.rollingWindow': defaultRollingWindow,
          'circuitBreaker.halfOpenMaxRequests': defaultHalfOpenMaxRequests,
        };
        return config[key];
      }),
    } as unknown as jest.Mocked<IConfigurationService>;

    mockLoggingService = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as jest.MockedObjectDeep<ILoggingService>;

    service = new CircuitBreakerService(
      mockConfigurationService,
      mockLoggingService,
    );
  });

  describe('Circuit Registration', () => {
    it('should register a new circuit', () => {
      const circuit = service.getOrRegisterCircuit('test-circuit');
      expect(circuit).toBeDefined();
      expect(circuit.name).toBe('test-circuit');
      expect(circuit.metrics.state).toBe(CircuitState.CLOSED);
    });

    it('should not overwrite existing circuit on re-registration', () => {
      const circuit = service.getOrRegisterCircuit('test-circuit');
      service.recordFailure(circuit);

      const sameCircuit = service.getOrRegisterCircuit('test-circuit');
      expect(sameCircuit.metrics.failureCount).toBe(1);
    });

    it('should use custom configuration', () => {
      const customFailureThreshold =
        defaultFailureThreshold + faker.number.int({ min: 5, max: 10 });
      const circuit = service.getOrRegisterCircuit('test-circuit', {
        failureThreshold: customFailureThreshold,
        successThreshold: defaultSuccessThreshold,
        timeout: defaultTimeout,
        rollingWindow: defaultRollingWindow,
        halfOpenMaxRequests: defaultHalfOpenMaxRequests,
      });

      // Should not open after defaultFailureThreshold failures (default threshold)
      for (let i = 0; i < defaultFailureThreshold; i++) {
        service.recordFailure(circuit);
      }
      expect(circuit.metrics.state).toBe(CircuitState.CLOSED);

      // Should open after customFailureThreshold failures (custom threshold)
      const additionalFailures =
        customFailureThreshold - defaultFailureThreshold;
      for (let i = 0; i < additionalFailures; i++) {
        service.recordFailure(circuit);
      }
      expect(circuit.metrics.state).toBe(CircuitState.OPEN);
    });
  });

  describe('CLOSED State', () => {
    it('should start in CLOSED state', () => {
      const circuit = service.getOrRegisterCircuit('test-circuit');
      expect(circuit.metrics.state).toBe(CircuitState.CLOSED);
    });

    it('should allow requests in CLOSED state', () => {
      service.getOrRegisterCircuit('test-circuit');
      expect(service.canProceed('test-circuit')).toBe(true);
    });

    it('should transition to OPEN after threshold failures', () => {
      const circuit = service.getOrRegisterCircuit('test-circuit', {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 60_000,
        rollingWindow: 120_000,
        halfOpenMaxRequests: 3,
      });

      service.recordFailure(circuit);
      service.recordFailure(circuit);
      expect(circuit.metrics.state).toBe(CircuitState.CLOSED);

      service.recordFailure(circuit);
      expect(circuit.metrics.state).toBe(CircuitState.OPEN);
    });

    it('should reset consecutive successes on failure', () => {
      const circuit = service.getOrRegisterCircuit('test-circuit', {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 60_000,
        rollingWindow: 120_000,
        halfOpenMaxRequests: 3,
      });

      service.recordSuccess(circuit.name);
      service.recordSuccess(circuit.name);
      expect(circuit.metrics.consecutiveSuccesses).toBe(2);

      service.recordFailure(circuit);
      expect(circuit.metrics.consecutiveSuccesses).toBe(0);
    });
  });

  describe('OPEN State', () => {
    beforeEach(() => {
      const circuit = service.getOrRegisterCircuit('test-circuit', {
        failureThreshold: 2,
        successThreshold: 2,
        timeout: 1000,
        rollingWindow: 120_000,
        halfOpenMaxRequests: 3,
      });
      // Trip the circuit
      service.recordFailure(circuit);
      service.recordFailure(circuit);
    });

    it('should block requests in OPEN state', () => {
      const circuit = service.get('test-circuit');
      expect(circuit?.metrics.state).toBe(CircuitState.OPEN);
      expect(service.canProceed('test-circuit')).toBe(false);
    });

    it('should transition to HALF_OPEN after timeout', (done) => {
      const circuit = service.get('test-circuit');
      expect(circuit?.metrics.state).toBe(CircuitState.OPEN);

      setTimeout(() => {
        // First call after timeout should transition to HALF_OPEN and allow request
        expect(service.canProceed('test-circuit')).toBe(true);
        const updatedCircuit = service.get('test-circuit');
        expect(updatedCircuit?.metrics.state).toBe(CircuitState.HALF_OPEN);
        done();
      }, 1100);
    });

    it('should not allow requests before timeout', (done) => {
      expect(service.canProceed('test-circuit')).toBe(false);

      setTimeout(() => {
        expect(service.canProceed('test-circuit')).toBe(false);
        const circuit = service.get('test-circuit');
        expect(circuit?.metrics.state).toBe(CircuitState.OPEN);
        done();
      }, 500);
    });
  });

  describe('HALF_OPEN State', () => {
    beforeEach(() => {
      const circuit = service.getOrRegisterCircuit('test-circuit', {
        failureThreshold: 2,
        successThreshold: 2,
        timeout: 100,
        rollingWindow: 120_000,
        halfOpenMaxRequests: 3,
      });
      // Trip the circuit
      service.recordFailure(circuit);
      service.recordFailure(circuit);
    });

    it('should allow limited requests in HALF_OPEN state', (done) => {
      setTimeout(() => {
        // Transition to HALF_OPEN (this counts as the first request)
        expect(service.canProceed('test-circuit')).toBe(true);
        const circuit = service.get('test-circuit');
        expect(circuit?.metrics.state).toBe(CircuitState.HALF_OPEN);

        // Should allow 2 more requests (total of 3 = halfOpenMaxRequests)
        expect(service.canProceed('test-circuit')).toBe(true);
        expect(service.canProceed('test-circuit')).toBe(true);

        // The 4th request should be blocked
        expect(service.canProceed('test-circuit')).toBe(false);
        done();
      }, 150);
    });

    it('should transition to CLOSED after consecutive successes', (done) => {
      setTimeout(() => {
        service.canProceed('test-circuit'); // Transition to HALF_OPEN
        const circuit = service.get('test-circuit');
        expect(circuit).toBeDefined();

        if (circuit) {
          service.recordSuccess(circuit.name);
          expect(circuit.metrics.state).toBe(CircuitState.HALF_OPEN);

          service.recordSuccess(circuit.name);
          // After threshold successes, circuit is removed (closed and cleaned up)
          const deletedCircuit = service.get('test-circuit');
          expect(deletedCircuit).toBeUndefined();
        }
        done();
      }, 150);
    });

    it('should transition back to OPEN on failure', (done) => {
      setTimeout(() => {
        service.canProceed('test-circuit'); // Transition to HALF_OPEN
        const circuit = service.get('test-circuit');
        expect(circuit).toBeDefined();

        if (circuit) {
          service.recordSuccess(circuit.name);
          service.recordFailure(circuit);
          expect(circuit.metrics.state).toBe(CircuitState.OPEN);
        }
        done();
      }, 150);
    });
  });

  describe('Metrics', () => {
    it('should track failure count', () => {
      const circuit = service.getOrRegisterCircuit('test-circuit');

      service.recordFailure(circuit);
      service.recordFailure(circuit);

      expect(circuit.metrics.failureCount).toBe(2);
    });

    it('should track success count', () => {
      const circuit = service.getOrRegisterCircuit('test-circuit');

      service.recordSuccess(circuit.name);
      service.recordSuccess(circuit.name);

      expect(circuit.metrics.successCount).toBe(2);
    });

    it('should track consecutive successes', () => {
      const circuit = service.getOrRegisterCircuit('test-circuit');

      service.recordSuccess(circuit.name);
      service.recordSuccess(circuit.name);
      service.recordFailure(circuit);
      service.recordSuccess(circuit.name);

      expect(circuit.metrics.consecutiveSuccesses).toBe(1);
    });
  });

  describe('Delete', () => {
    it('should delete a single circuit', () => {
      const circuit = service.getOrRegisterCircuit('test-circuit');

      service.recordFailure(circuit);
      service.recordFailure(circuit);

      service.delete('test-circuit');

      const deletedCircuit = service.get('test-circuit');
      expect(deletedCircuit).toBeUndefined();
    });

    it('should delete all circuits', () => {
      service.getOrRegisterCircuit('circuit-1');
      service.getOrRegisterCircuit('circuit-2');

      const circuit1 = service.get('circuit-1');
      const circuit2 = service.get('circuit-2');

      if (circuit1) service.recordFailure(circuit1);
      if (circuit2) service.recordFailure(circuit2);

      service.deleteAll();

      expect(service.get('circuit-1')).toBeUndefined();
      expect(service.get('circuit-2')).toBeUndefined();
    });
  });

  describe('Auto-create Circuit', () => {
    it('should allow requests when circuit does not exist', () => {
      expect(service.canProceed('new-circuit')).toBe(true);
    });

    it('should not auto-create circuit on canProceed', () => {
      service.canProceed('new-circuit');
      const circuit = service.get('new-circuit');
      expect(circuit).toBeUndefined();
    });
  });

  describe('Enabled/Disabled', () => {
    it('should enforce circuit breaker logic when circuitBreaker is enabled (the default behavior)', () => {
      const circuit = service.getOrRegisterCircuit('test-circuit');

      expect(service.canProceed('test-circuit')).toBe(true);

      for (let i = 0; i < defaultFailureThreshold; i++) {
        service.recordFailure(circuit);
      }

      expect(circuit.metrics.state).toBe(CircuitState.OPEN);
      expect(service.canProceed('test-circuit')).toBe(false);
    });

    it('should bypass circuit breaker logic when circuitBreaker is disabled', () => {
      const disabledConfigService = {
        getOrThrow: jest.fn((key: string) => {
          if (key === 'circuitBreaker.enabled') {
            return false;
          }
          return mockConfigurationService.getOrThrow(key);
        }),
      } as unknown as jest.Mocked<IConfigurationService>;

      const disabledService = new CircuitBreakerService(
        disabledConfigService,
        mockLoggingService,
      );

      const circuit = disabledService.getOrRegisterCircuit('test-circuit');

      for (let i = 0; i < defaultFailureThreshold; i++) {
        disabledService.recordFailure(circuit);
      }

      expect(circuit.metrics.state).toBe(CircuitState.OPEN);
      expect(disabledService.canProceed('test-circuit')).toBe(true);
    });
  });
});
