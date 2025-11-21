import { CircuitBreakerService } from '@/datasources/circuit-breaker/circuit-breaker.service';
import { CircuitState } from '@/datasources/circuit-breaker/enums/circuit-state.enum';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = new CircuitBreakerService();
  });

  describe('Circuit Registration', () => {
    it('should register a new circuit', () => {
      service.registerCircuit('test-circuit');
      const state = service.getState('test-circuit');
      expect(state).toBe(CircuitState.CLOSED);
    });

    it('should not overwrite existing circuit on re-registration', () => {
      service.registerCircuit('test-circuit');
      service.recordFailure('test-circuit');
      service.registerCircuit('test-circuit');

      const metrics = service.getMetrics('test-circuit');
      expect(metrics.failureCount).toBe(1);
    });

    it('should use custom configuration', () => {
      service.registerCircuit('test-circuit', {
        failureThreshold: 10,
        timeout: 30000,
      });

      // Should not open after 5 failures (default threshold)
      for (let i = 0; i < 5; i++) {
        service.recordFailure('test-circuit');
      }
      expect(service.getState('test-circuit')).toBe(CircuitState.CLOSED);

      // Should open after 10 failures (custom threshold)
      for (let i = 0; i < 5; i++) {
        service.recordFailure('test-circuit');
      }
      expect(service.getState('test-circuit')).toBe(CircuitState.OPEN);
    });
  });

  describe('CLOSED State', () => {
    it('should start in CLOSED state', () => {
      service.registerCircuit('test-circuit');
      expect(service.getState('test-circuit')).toBe(CircuitState.CLOSED);
    });

    it('should allow requests in CLOSED state', () => {
      service.registerCircuit('test-circuit');
      expect(service.canProceed('test-circuit')).toBe(true);
    });

    it('should transition to OPEN after threshold failures', () => {
      service.registerCircuit('test-circuit', { failureThreshold: 3 });

      service.recordFailure('test-circuit');
      service.recordFailure('test-circuit');
      expect(service.getState('test-circuit')).toBe(CircuitState.CLOSED);

      service.recordFailure('test-circuit');
      expect(service.getState('test-circuit')).toBe(CircuitState.OPEN);
    });

    it('should reset failure count on success', () => {
      service.registerCircuit('test-circuit', { failureThreshold: 3 });

      service.recordFailure('test-circuit');
      service.recordFailure('test-circuit');
      service.recordSuccess('test-circuit');

      // Should not open after 1 more failure (count was reset)
      service.recordFailure('test-circuit');
      expect(service.getState('test-circuit')).toBe(CircuitState.CLOSED);
    });
  });

  describe('OPEN State', () => {
    beforeEach(() => {
      service.registerCircuit('test-circuit', {
        failureThreshold: 2,
        timeout: 1000,
      });
      // Trip the circuit
      service.recordFailure('test-circuit');
      service.recordFailure('test-circuit');
    });

    it('should block requests in OPEN state', () => {
      expect(service.getState('test-circuit')).toBe(CircuitState.OPEN);
      expect(service.canProceed('test-circuit')).toBe(false);
    });

    it('should transition to HALF_OPEN after timeout', (done) => {
      expect(service.getState('test-circuit')).toBe(CircuitState.OPEN);

      setTimeout(() => {
        // First call after timeout should transition to HALF_OPEN and allow request
        expect(service.canProceed('test-circuit')).toBe(true);
        expect(service.getState('test-circuit')).toBe(CircuitState.HALF_OPEN);
        done();
      }, 1100);
    });

    it('should not allow requests before timeout', (done) => {
      expect(service.canProceed('test-circuit')).toBe(false);

      setTimeout(() => {
        expect(service.canProceed('test-circuit')).toBe(false);
        expect(service.getState('test-circuit')).toBe(CircuitState.OPEN);
        done();
      }, 500);
    });
  });

  describe('HALF_OPEN State', () => {
    beforeEach(() => {
      service.registerCircuit('test-circuit', {
        failureThreshold: 2,
        timeout: 100,
        successThreshold: 2,
        halfOpenMaxRequests: 3,
      });
      // Trip the circuit
      service.recordFailure('test-circuit');
      service.recordFailure('test-circuit');
    });

    it('should allow limited requests in HALF_OPEN state', (done) => {
      setTimeout(() => {
        // Transition to HALF_OPEN (this counts as the first request)
        expect(service.canProceed('test-circuit')).toBe(true);
        expect(service.getState('test-circuit')).toBe(CircuitState.HALF_OPEN);

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

        service.recordSuccess('test-circuit');
        expect(service.getState('test-circuit')).toBe(CircuitState.HALF_OPEN);

        service.recordSuccess('test-circuit');
        expect(service.getState('test-circuit')).toBe(CircuitState.CLOSED);
        done();
      }, 150);
    });

    it('should transition back to OPEN on failure', (done) => {
      setTimeout(() => {
        service.canProceed('test-circuit'); // Transition to HALF_OPEN

        service.recordSuccess('test-circuit');
        service.recordFailure('test-circuit');

        expect(service.getState('test-circuit')).toBe(CircuitState.OPEN);
        done();
      }, 150);
    });
  });

  describe('Metrics', () => {
    it('should track failure count', () => {
      service.registerCircuit('test-circuit');

      service.recordFailure('test-circuit');
      service.recordFailure('test-circuit');

      const metrics = service.getMetrics('test-circuit');
      expect(metrics.failureCount).toBe(2);
    });

    it('should track success count', () => {
      service.registerCircuit('test-circuit');

      service.recordSuccess('test-circuit');
      service.recordSuccess('test-circuit');

      const metrics = service.getMetrics('test-circuit');
      expect(metrics.successCount).toBe(2);
    });

    it('should track consecutive successes', () => {
      service.registerCircuit('test-circuit');

      service.recordSuccess('test-circuit');
      service.recordSuccess('test-circuit');
      service.recordFailure('test-circuit');
      service.recordSuccess('test-circuit');

      const metrics = service.getMetrics('test-circuit');
      expect(metrics.consecutiveSuccesses).toBe(1);
    });
  });

  describe('Reset', () => {
    it('should reset a single circuit', () => {
      service.registerCircuit('test-circuit');

      service.recordFailure('test-circuit');
      service.recordFailure('test-circuit');

      service.reset('test-circuit');

      const metrics = service.getMetrics('test-circuit');
      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);
    });

    it('should reset all circuits', () => {
      service.registerCircuit('circuit-1');
      service.registerCircuit('circuit-2');

      service.recordFailure('circuit-1');
      service.recordFailure('circuit-2');

      service.resetAll();

      expect(service.getMetrics('circuit-1').failureCount).toBe(0);
      expect(service.getMetrics('circuit-2').failureCount).toBe(0);
    });
  });

  describe('Auto-create Circuit', () => {
    it('should auto-create circuit on first use', () => {
      expect(service.canProceed('new-circuit')).toBe(true);
      expect(service.getState('new-circuit')).toBe(CircuitState.CLOSED);
    });

    it('should track failures on auto-created circuit', () => {
      service.recordFailure('new-circuit');
      const metrics = service.getMetrics('new-circuit');
      expect(metrics.failureCount).toBe(1);
    });
  });
});
