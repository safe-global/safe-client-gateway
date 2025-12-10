import type { ICircuitBreakerInterceptorOptions } from '@/datasources/circuit-breaker/interfaces/circuit-breaker.interface';
import {
  CIRCUIT_BREAKER_OPTIONS_METADATA_KEY,
  CircuitBreakerInterceptor,
} from '@/routes/common/interceptors/circuit-breaker.interceptor';
import { SetMetadata } from '@nestjs/common';
import { UseInterceptors, applyDecorators } from '@nestjs/common';

/**
 * Circuit Breaker Decorator
 *
 * This decorator applies the circuit breaker pattern to methods or classes.
 * It automatically applies the CircuitBreakerInterceptor and sets metadata
 * for configuration options.
 *
 * @param {string} name - The name of the circuit breaker
 * @param {Partial<ICircuitBreakerInterceptorOptions>} options - Optional configuration options
 *
 * @returns {MethodDecorator & ClassDecorator} A decorator that can be applied to methods or classes
 *
 */
export function CircuitBreaker(
  name: string,
  options?: Partial<Exclude<ICircuitBreakerInterceptorOptions, 'name'>>,
): MethodDecorator & ClassDecorator {
  const optionsWithName: Partial<ICircuitBreakerInterceptorOptions> = {
    ...(options ?? {}),
    name,
  };

  return applyDecorators(
    SetMetadata(CIRCUIT_BREAKER_OPTIONS_METADATA_KEY, optionsWithName),
    UseInterceptors(CircuitBreakerInterceptor),
  );
}
