import { SetMetadata } from '@nestjs/common';
import type { CircuitBreakerConfig } from '@/datasources/circuit-breaker/interfaces/circuit-breaker-config.interface';

export const CIRCUIT_BREAKER_KEY = 'circuit-breaker';

/**
 * Options for configuring circuit breaker via decorator
 */
export interface CircuitBreakerDecoratorOptions {
  /**
   * Unique name for this circuit. If not provided, uses the route path
   */
  name?: string;

  /**
   * Circuit breaker configuration
   */
  config?: CircuitBreakerConfig;

  /**
   * Whether to disable circuit breaker for this route
   */
  disabled?: boolean;
}

/**
 * Decorator to configure circuit breaker behavior for a specific route
 *
 * @param {CircuitBreakerDecoratorOptions} [options] - Circuit breaker configuration options
 * @returns {MethodDecorator} Method decorator
 *
 * @example
 * ```typescript
 * @Get('/external-data')
 * @CircuitBreaker({
 *   name: 'external-api',
 *   config: {
 *     failureThreshold: 3,
 *     timeout: 30000,
 *   }
 * })
 * async getData() {
 *   return await this.externalService.fetchData();
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Disable circuit breaker for a specific route
 * @Get('/internal-data')
 * @CircuitBreaker({ disabled: true })
 * async getInternalData() {
 *   return await this.internalService.fetchData();
 * }
 * ```
 */
export const CircuitBreaker = (
  options?: CircuitBreakerDecoratorOptions,
): MethodDecorator => SetMetadata(CIRCUIT_BREAKER_KEY, options || {});
