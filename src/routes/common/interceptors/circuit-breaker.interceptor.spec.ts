import { CircuitBreakerInterceptor } from '@/routes/common/interceptors/circuit-breaker.interceptor';
import { CircuitBreakerService } from '@/datasources/circuit-breaker/circuit-breaker.service';
import { CircuitState } from '@/datasources/circuit-breaker/enums/circuit-state.enum';
import type { ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { Reflector } from '@nestjs/core';
import { CircuitBreakerException } from '@/datasources/circuit-breaker/exceptions/circuit-breaker.exception';

describe('CircuitBreakerInterceptor', () => {
  let interceptor: CircuitBreakerInterceptor;
  let service: CircuitBreakerService;
  let mockConfigurationService: jest.Mocked<IConfigurationService>;
  let mockReflector: jest.Mocked<Reflector>;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: {
    handle: jest.Mock;
  };

  beforeEach(() => {
    mockConfigurationService = {
      getOrThrow: jest.fn((key: string) => {
        const config: Record<string, number | boolean> = {
          'circuitBreaker.failureThreshold': 5,
          'circuitBreaker.successThreshold': 2,
          'circuitBreaker.timeout': 60_000,
          'circuitBreaker.rollingWindow': 120_000,
          'circuitBreaker.halfOpenMaxRequests': 3,
          'circuitBreaker.enabled': true,
        };
        return config[key];
      }),
    } as unknown as jest.Mocked<IConfigurationService>;

    service = new CircuitBreakerService(mockConfigurationService);
    service.deleteAll();

    mockReflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          route: { path: '/test' },
          path: '/test',
        }),
      }),
      getHandler: jest.fn().mockReturnValue({}),
      getClass: jest.fn().mockReturnValue({}),
    } as unknown as ExecutionContext;

    mockCallHandler = {
      handle: jest.fn(),
    };
  });

  describe('Basic Functionality', () => {
    it('should allow request when circuit is closed', (done) => {
      mockReflector.getAllAndOverride.mockReturnValue({
        name: 'test-circuit',
      });

      interceptor = new CircuitBreakerInterceptor(
        service,
        mockReflector,
        mockConfigurationService,
      );

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
      mockReflector.getAllAndOverride.mockReturnValue({
        name: 'test-circuit-open',
        config: {
          failureThreshold: 2,
          successThreshold: 2,
          timeout: 60_000,
          rollingWindow: 120_000,
          halfOpenMaxRequests: 3,
        },
      });

      interceptor = new CircuitBreakerInterceptor(
        service,
        mockReflector,
        mockConfigurationService,
      );

      // Trip the circuit
      const circuit = service.getOrRegisterCircuit('test-circuit-open', {
        failureThreshold: 2,
        successThreshold: 2,
        timeout: 60_000,
        rollingWindow: 120_000,
        halfOpenMaxRequests: 3,
      });
      service.recordFailure(circuit);
      service.recordFailure(circuit);

      try {
        interceptor.intercept(mockExecutionContext, mockCallHandler as never);
        fail('Should have thrown CircuitBreakerException');
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerException);
      }
    });

    it('should not track circuit on successful request (memory optimization)', (done) => {
      mockReflector.getAllAndOverride.mockReturnValue({
        name: 'test-circuit',
      });

      interceptor = new CircuitBreakerInterceptor(
        service,
        mockReflector,
        mockConfigurationService,
      );

      mockCallHandler.handle.mockReturnValue(of('success'));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          next: () => {
            // Circuit shouldn't exist since there were no failures (memory optimization)
            const circuit = service.get('test-circuit');
            expect(circuit).toBeUndefined();
            done();
          },
        });
    });

    it('should record failure on error', (done) => {
      mockReflector.getAllAndOverride.mockReturnValue({
        name: 'test-circuit',
      });

      interceptor = new CircuitBreakerInterceptor(
        service,
        mockReflector,
        mockConfigurationService,
      );

      const error = new Error('Test error');
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          error: () => {
            const circuit = service.get('test-circuit');
            expect(circuit).toBeDefined();
            expect(circuit?.metrics.failureCount).toBe(1);
            done();
          },
        });
    });
  });

  describe('Circuit Naming', () => {
    it('should use provided name (no circuit created on success)', (done) => {
      mockReflector.getAllAndOverride.mockReturnValue({
        name: 'custom-circuit',
        config: {
          failureThreshold: 5,
          successThreshold: 2,
          timeout: 60_000,
          rollingWindow: 120_000,
          halfOpenMaxRequests: 3,
        },
      });

      interceptor = new CircuitBreakerInterceptor(
        service,
        mockReflector,
        mockConfigurationService,
      );

      mockCallHandler.handle.mockReturnValue(of('success'));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          next: () => {
            // Circuit not created on success (memory optimization)
            const circuit = service.get('custom-circuit');
            expect(circuit).toBeUndefined();
            done();
          },
        });
    });

    it('should use custom name if provided (no circuit created on success)', (done) => {
      mockReflector.getAllAndOverride.mockReturnValue({
        name: 'custom-test-circuit',
        config: {
          failureThreshold: 5,
          successThreshold: 2,
          timeout: 60_000,
          rollingWindow: 120_000,
          halfOpenMaxRequests: 3,
        },
      });

      interceptor = new CircuitBreakerInterceptor(
        service,
        mockReflector,
        mockConfigurationService,
      );

      mockCallHandler.handle.mockReturnValue(of('success'));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          next: () => {
            // Circuit not created on success (memory optimization)
            const circuit = service.get('custom-test-circuit');
            expect(circuit).toBeUndefined();
            done();
          },
        });
    });

    it('should default to route path (no tracking without config)', (done) => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      interceptor = new CircuitBreakerInterceptor(
        service,
        mockReflector,
        mockConfigurationService,
      );

      mockCallHandler.handle.mockReturnValue(of('success'));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          next: () => {
            // No circuit should exist since no config provided (memory optimization)
            const circuit = service.get('/test');
            expect(circuit).toBeUndefined();
            done();
          },
        });
    });
  });

  describe('Failure Predicate', () => {
    it('should not count 4xx errors as failures by default', (done) => {
      mockReflector.getAllAndOverride.mockReturnValue({
        name: 'test-circuit',
      });

      interceptor = new CircuitBreakerInterceptor(
        service,
        mockReflector,
        mockConfigurationService,
      );

      const error = new HttpException('Not Found', HttpStatus.NOT_FOUND);
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          error: () => {
            // Circuit shouldn't exist since 4xx errors don't count as failures
            const circuit = service.get('test-circuit');
            expect(circuit).toBeUndefined();
            done();
          },
        });
    });

    it('should count 5xx errors as failures by default', (done) => {
      mockReflector.getAllAndOverride.mockReturnValue({
        name: 'test-circuit',
      });

      interceptor = new CircuitBreakerInterceptor(
        service,
        mockReflector,
        mockConfigurationService,
      );

      const error = new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          error: () => {
            const circuit = service.get('test-circuit');
            expect(circuit).toBeDefined();
            expect(circuit?.metrics.failureCount).toBe(1);
            done();
          },
        });
    });

    it('should use custom isFailure predicate', (done) => {
      mockReflector.getAllAndOverride.mockReturnValue({
        name: 'test-circuit',
        isFailure: (error: Error): boolean => error.message.includes('timeout'),
      });

      interceptor = new CircuitBreakerInterceptor(
        service,
        mockReflector,
        mockConfigurationService,
      );

      const error = new Error('Connection timeout');
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          error: () => {
            const circuit = service.get('test-circuit');
            expect(circuit).toBeDefined();
            expect(circuit?.metrics.failureCount).toBe(1);
            done();
          },
        });
    });

    it('should not count error if custom predicate returns false', (done) => {
      mockReflector.getAllAndOverride.mockReturnValue({
        name: 'test-circuit',
        isFailure: (): boolean => false,
      });

      interceptor = new CircuitBreakerInterceptor(
        service,
        mockReflector,
        mockConfigurationService,
      );

      const error = new Error('Test error');
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          error: () => {
            // Circuit shouldn't exist since custom predicate returns false
            const circuit = service.get('test-circuit');
            expect(circuit).toBeUndefined();
            done();
          },
        });
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom circuit configuration', () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        name: 'custom-config-circuit',
        config: {
          failureThreshold: 10,
          successThreshold: 2,
          timeout: 60_000,
          rollingWindow: 120_000,
          halfOpenMaxRequests: 3,
        },
      });

      interceptor = new CircuitBreakerInterceptor(
        service,
        mockReflector,
        mockConfigurationService,
      );

      // Get or register circuit with custom config before recording failures
      const circuit = service.getOrRegisterCircuit('custom-config-circuit', {
        failureThreshold: 10,
        successThreshold: 2,
        timeout: 60_000,
        rollingWindow: 120_000,
        halfOpenMaxRequests: 3,
      });

      mockCallHandler.handle.mockReturnValue(of('success'));

      // Should not trip after 5 failures (default threshold)
      for (let i = 0; i < 5; i++) {
        service.recordFailure(circuit);
      }

      // Should not throw because threshold is 10, not 5
      expect(circuit.metrics.state).toBe(CircuitState.CLOSED);
      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler as never,
      );
      expect(result).toBeDefined();
    });

    it('should use custom error message', () => {
      const customMessage = 'Custom circuit open message';
      mockReflector.getAllAndOverride.mockReturnValue({
        name: 'custom-message-circuit',
        config: {
          failureThreshold: 1,
          successThreshold: 2,
          timeout: 60_000,
          rollingWindow: 120_000,
          halfOpenMaxRequests: 3,
        },
        openCircuitMessage: customMessage,
      });

      interceptor = new CircuitBreakerInterceptor(
        service,
        mockReflector,
        mockConfigurationService,
      );

      // Get or register circuit before recording failure
      const circuit = service.getOrRegisterCircuit('custom-message-circuit', {
        failureThreshold: 1,
        successThreshold: 2,
        timeout: 60_000,
        rollingWindow: 120_000,
        halfOpenMaxRequests: 3,
      });

      service.recordFailure(circuit);

      try {
        interceptor.intercept(mockExecutionContext, mockCallHandler as never);
        fail('Should have thrown CircuitBreakerException');
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerException);
        if (error instanceof HttpException) {
          const response = error.getResponse() as { message: string };
          expect(response.message).toBe(customMessage);
        }
      }
    });
  });

  describe('Integration with Circuit States', () => {
    it('should trip circuit after threshold failures', (done) => {
      mockReflector.getAllAndOverride.mockReturnValue({
        name: 'test-circuit',
        config: {
          failureThreshold: 3,
          successThreshold: 2,
          timeout: 60_000,
          rollingWindow: 120_000,
          halfOpenMaxRequests: 3,
        },
      });

      interceptor = new CircuitBreakerInterceptor(
        service,
        mockReflector,
        mockConfigurationService,
      );

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
                  fail('Should have thrown CircuitBreakerException');
                } catch (e) {
                  expect(e).toBeInstanceOf(CircuitBreakerException);
                  done();
                }
              }
            },
          });
      };

      makeCall();
    });
  });

  describe('Circuit Breaker disabled', () => {
    it('should bypass circuit breaker when disabled', (done) => {
      const disabledConfigService = {
        getOrThrow: jest.fn((key: string) => {
          if (key === 'circuitBreaker.enabled') {
            return false;
          }
          return mockConfigurationService.getOrThrow(key);
        }),
      } as unknown as jest.Mocked<IConfigurationService>;

      const disabledService = new CircuitBreakerService(disabledConfigService);
      mockReflector.getAllAndOverride.mockReturnValue({
        name: 'test-circuit',
      });

      interceptor = new CircuitBreakerInterceptor(
        disabledService,
        mockReflector,
        disabledConfigService,
      );

      mockCallHandler.handle.mockReturnValue(of('success'));

      interceptor
        .intercept(mockExecutionContext, mockCallHandler as never)
        .subscribe({
          next: (result) => {
            expect(result).toBe('success');
            done();
          },
        });
    });
  });
});
