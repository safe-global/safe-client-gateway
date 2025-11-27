import { CircuitBreakerInterceptor } from '@/routes/common/interceptors/circuit-breaker.interceptor';
import { CircuitBreakerService } from '@/datasources/circuit-breaker/circuit-breaker.service';
import { CircuitState } from '@/datasources/circuit-breaker/enums/circuit-state.enum';
import type { ExecutionContext } from '@nestjs/common';
import { ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

describe('CircuitBreakerInterceptor', () => {
  let interceptor: CircuitBreakerInterceptor;
  let service: CircuitBreakerService;
  let reflector: Reflector;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: {
    handle: jest.Mock;
  };

  beforeEach(() => {
    service = new CircuitBreakerService();
    service.resetAll(); // Ensure clean state for each test
    reflector = new Reflector();
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          route: { path: '/test' },
          path: '/test',
        }),
      }),
      getHandler: jest.fn().mockReturnValue({}),
    } as unknown as ExecutionContext;

    mockCallHandler = {
      handle: jest.fn(),
    };
  });

  describe('Basic Functionality', () => {
    it('should allow request when circuit is closed', (done) => {
      interceptor = new CircuitBreakerInterceptor(service, reflector, {
        name: 'test-circuit',
      });

      mockCallHandler.handle.mockReturnValue(of('success'));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          next: (result) => {
            expect(result).toBe('success');
            expect(mockCallHandler.handle).toHaveBeenCalled();
            done();
          },
        });
    });

    it('should block request when circuit is open', () => {
      interceptor = new CircuitBreakerInterceptor(service, reflector, {
        name: 'test-circuit-open',
        config: { failureThreshold: 2 },
      });

      // Register circuit before recording failures
      service.registerCircuit('test-circuit-open', { failureThreshold: 2 });

      // Trip the circuit
      service.recordFailure('test-circuit-open');
      service.recordFailure('test-circuit-open');

      try {
        interceptor.intercept(mockExecutionContext, mockCallHandler as never);
        fail('Should have thrown ServiceUnavailableException');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
      }
    });

    it('should record success on successful request', (done) => {
      interceptor = new CircuitBreakerInterceptor(service, reflector, {
        name: 'test-circuit',
      });

      mockCallHandler.handle.mockReturnValue(of('success'));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          next: () => {
            const metrics = service.getMetrics('test-circuit');
            expect(metrics.successCount).toBe(1);
            done();
          },
        });
    });

    it('should record failure on error', (done) => {
      interceptor = new CircuitBreakerInterceptor(service, reflector, {
        name: 'test-circuit',
      });

      const error = new Error('Test error');
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          error: () => {
            const metrics = service.getMetrics('test-circuit');
            expect(metrics.failureCount).toBe(1);
            done();
          },
        });
    });
  });

  describe('Circuit Naming', () => {
    it('should use provided name', (done) => {
      interceptor = new CircuitBreakerInterceptor(service, reflector, {
        name: 'custom-circuit',
      });

      mockCallHandler.handle.mockReturnValue(of('success'));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          next: () => {
            const metrics = service.getMetrics('custom-circuit');
            expect(metrics.successCount).toBe(1);
            done();
          },
        });
    });

    it('should use nameExtractor if provided', (done) => {
      interceptor = new CircuitBreakerInterceptor(service, reflector, {
        nameExtractor: (request): string => `circuit-${request.path}`,
      });

      mockCallHandler.handle.mockReturnValue(of('success'));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          next: () => {
            const metrics = service.getMetrics('circuit-/test');
            expect(metrics.successCount).toBe(1);
            done();
          },
        });
    });

    it('should default to route path', (done) => {
      interceptor = new CircuitBreakerInterceptor(service, reflector);

      mockCallHandler.handle.mockReturnValue(of('success'));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          next: () => {
            const metrics = service.getMetrics('/test');
            expect(metrics.successCount).toBe(1);
            done();
          },
        });
    });
  });

  describe('Failure Predicate', () => {
    it('should not count 4xx errors as failures by default', (done) => {
      interceptor = new CircuitBreakerInterceptor(service, reflector, {
        name: 'test-circuit',
      });

      const error = new HttpException('Not Found', HttpStatus.NOT_FOUND);
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          error: () => {
            const metrics = service.getMetrics('test-circuit');
            expect(metrics.failureCount).toBe(0);
            done();
          },
        });
    });

    it('should count 5xx errors as failures by default', (done) => {
      interceptor = new CircuitBreakerInterceptor(service, reflector, {
        name: 'test-circuit',
      });

      const error = new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          error: () => {
            const metrics = service.getMetrics('test-circuit');
            expect(metrics.failureCount).toBe(1);
            done();
          },
        });
    });

    it('should use custom isFailure predicate', (done) => {
      interceptor = new CircuitBreakerInterceptor(service, reflector, {
        name: 'test-circuit',
        isFailure: (error): boolean => error.message.includes('timeout'),
      });

      const error = new Error('Connection timeout');
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          error: () => {
            const metrics = service.getMetrics('test-circuit');
            expect(metrics.failureCount).toBe(1);
            done();
          },
        });
    });

    it('should not count error if custom predicate returns false', (done) => {
      interceptor = new CircuitBreakerInterceptor(service, reflector, {
        name: 'test-circuit',
        isFailure: (): boolean => false,
      });

      const error = new Error('Test error');
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          error: () => {
            const metrics = service.getMetrics('test-circuit');
            expect(metrics.failureCount).toBe(0);
            done();
          },
        });
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom circuit configuration', () => {
      interceptor = new CircuitBreakerInterceptor(service, reflector, {
        name: 'custom-config-circuit',
        config: {
          failureThreshold: 10,
        },
      });

      // Register circuit with custom config before recording failures
      service.registerCircuit('custom-config-circuit', {
        failureThreshold: 10,
      });

      mockCallHandler.handle.mockReturnValue(of('success'));

      // Should not trip after 5 failures (default threshold)
      for (let i = 0; i < 5; i++) {
        service.recordFailure('custom-config-circuit');
      }

      // Should not throw because threshold is 10, not 5
      expect(service.getState('custom-config-circuit')).toBe(
        CircuitState.CLOSED,
      );
      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler as never,
      );
      expect(result).toBeDefined();
    });

    it('should use custom error message', () => {
      const customMessage = 'Custom circuit open message';
      interceptor = new CircuitBreakerInterceptor(service, reflector, {
        name: 'custom-message-circuit',
        config: { failureThreshold: 1 },
        openCircuitMessage: customMessage,
      });

      // Register circuit before recording failure
      service.registerCircuit('custom-message-circuit', {
        failureThreshold: 1,
      });

      service.recordFailure('custom-message-circuit');

      try {
        interceptor.intercept(mockExecutionContext, mockCallHandler as never);
        fail('Should have thrown ServiceUnavailableException');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        if (error instanceof HttpException) {
          const response = error.getResponse() as { message: string };
          expect(response.message).toBe(customMessage);
        }
      }
    });
  });

  describe('Integration with Circuit States', () => {
    it('should trip circuit after threshold failures', (done) => {
      interceptor = new CircuitBreakerInterceptor(service, reflector, {
        name: 'test-circuit',
        config: { failureThreshold: 3 },
      });

      const error = new Error('Test error');
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      // First 3 failures should be allowed through
      let callCount = 0;
      const makeCall = (): void => {
        interceptor
          .intercept(mockExecutionContext, mockCallHandler as never)
          .subscribe({
            error: () => {
              callCount++;
              if (callCount < 3) {
                makeCall();
              } else {
                // 4th call should be blocked by open circuit
                try {
                  interceptor.intercept(
                    mockExecutionContext,
                    mockCallHandler as never,
                  );
                  fail('Should have thrown ServiceUnavailableException');
                } catch (e) {
                  expect(e).toBeInstanceOf(ServiceUnavailableException);
                  done();
                }
              }
            },
          });
      };

      makeCall();
    });
  });
});
