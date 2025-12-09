import type { CircuitBreakerInterceptorOptions } from '@/datasources/circuit-breaker/interfaces/circuit-breaker-interceptor-options.interface';
import { CircuitBreakerInterceptor } from '@/routes/common/interceptors/circuit-breaker.interceptor';
import { SetMetadata } from '@nestjs/common';
import { UseInterceptors, applyDecorators } from '@nestjs/common';

export const CIRCUIT_BREAKER_OPTIONS_METADATA_KEY = 'CircuitBreakerOptions';

/**
 * Circuit Breaker Decorator
 *
 * This decorator applies the circuit breaker pattern to methods or classes.
 * It automatically applies the CircuitBreakerInterceptor and sets metadata
 * for configuration options.
 *
 * @param {string} name - The name of the circuit breaker
 * @param {Partial<CircuitBreakerInterceptorOptions>} options - Optional configuration options
 *
 * @returns {MethodDecorator & ClassDecorator} A decorator that can be applied to methods or classes
 *
 */
export function CircuitBreaker(
  name: string,
  options?: Partial<CircuitBreakerInterceptorOptions>,
): MethodDecorator & ClassDecorator {
  options = options ?? {};
  options.name = name;

  return applyDecorators(
    SetMetadata(CIRCUIT_BREAKER_OPTIONS_METADATA_KEY, options),
    UseInterceptors(CircuitBreakerInterceptor),
  );
}
