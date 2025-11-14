import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { CircuitBreakerService } from '@/datasources/circuit-breaker/circuit-breaker.service';
import type { CircuitBreakerInterceptorOptions } from '@/datasources/circuit-breaker/interfaces/circuit-breaker-interceptor-options.interface';
import {
  CIRCUIT_BREAKER_KEY,
  type CircuitBreakerDecoratorOptions,
} from '@/routes/common/decorators/circuit-breaker.decorator';
import type { Request } from 'express';

/**
 * Circuit Breaker Interceptor
 *
 * This interceptor implements the circuit breaker pattern for HTTP endpoints.
 * It monitors request failures and can automatically "trip" to prevent
 * further requests to failing services.
 *
 * Usage:
 * ```typescript
 * @UseInterceptors(new CircuitBreakerInterceptor({
 *   name: 'my-external-api',
 *   config: {
 *     failureThreshold: 5,
 *     timeout: 60000,
 *   }
 * }))
 * @Get('/example')
 * async example() {
 *   // Your route logic
 * }
 * ```
 *
 * @see https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern
 */
@Injectable()
export class CircuitBreakerInterceptor implements NestInterceptor {
  private readonly options: CircuitBreakerInterceptorOptions;

  /**
   * Creates a new CircuitBreakerInterceptor instance
   *
   * @param {CircuitBreakerService} circuitBreakerService - The circuit breaker service instance
   * @param {Reflector} reflector - NestJS Reflector for reading metadata
   * @param {CircuitBreakerInterceptorOptions} [options] - Configuration options for the interceptor
   */
  public constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly reflector: Reflector,
    options?: CircuitBreakerInterceptorOptions,
  ) {
    this.options = this.buildOptions(options);
  }

  private buildOptions(
    options?: CircuitBreakerInterceptorOptions,
  ): CircuitBreakerInterceptorOptions {
    return {
      // Default: use route path as circuit name for global interceptor
      nameExtractor: (request): string => request.route?.path || request.path,
      isFailure: (error: Error): boolean => this.defaultIsFailure(error),
      openCircuitMessage:
        'Service temporarily unavailable due to high error rate',
      config: {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60_000,
        halfOpenMaxRequests: 3,
      },
      ...options,
    };
  }

  /**
   * Intercepts the request and applies circuit breaker logic
   *
   * @param {ExecutionContext} context - The execution context
   * @param {CallHandler} next - The next handler in the chain
   * @returns {Observable<unknown>} Observable of the response
   */
  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    // Check for route-specific circuit breaker configuration
    const decoratorOptions = this.reflector.get<CircuitBreakerDecoratorOptions>(
      CIRCUIT_BREAKER_KEY,
      context.getHandler(),
    );

    // Skip circuit breaker if explicitly disabled for this route
    if (decoratorOptions?.disabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Merge decorator options with interceptor options
    const mergedOptions: CircuitBreakerInterceptorOptions = {
      ...this.options,
      ...decoratorOptions,
    };

    // Merge configs separately to handle undefined decorator options
    if (this.options.config || decoratorOptions?.config) {
      mergedOptions.config = {
        ...this.options.config,
        ...decoratorOptions?.config,
      };
    }

    // Determine circuit name from decorator, extractor, or default
    let circuitName: string;
    if (decoratorOptions?.name) {
      circuitName = decoratorOptions.name;
    } else if (this.options.name) {
      circuitName = this.options.name;
    } else if (mergedOptions.nameExtractor) {
      circuitName = mergedOptions.nameExtractor(request);
    } else {
      circuitName = this.getCircuitName(request);
    }

    // Register circuit if it doesn't exist
    if (mergedOptions.config) {
      this.circuitBreakerService.registerCircuit(
        circuitName,
        mergedOptions.config,
      );
    }

    // Check if circuit allows the request
    if (!this.circuitBreakerService.canProceed(circuitName)) {
      throw new ServiceUnavailableException({
        message:
          mergedOptions.openCircuitMessage || this.options.openCircuitMessage,
        circuitState: 'OPEN',
        circuitName,
      });
    }

    return next.handle().pipe(
      tap(() => {
        // Record success
        this.circuitBreakerService.recordSuccess(circuitName);
      }),
      catchError((error: Error) => {
        // Record failure if the error matches the failure predicate
        const isFailureFn = mergedOptions.isFailure || this.options.isFailure!;
        if (isFailureFn(error)) {
          this.circuitBreakerService.recordFailure(circuitName);
        }
        return throwError(() => error);
      }),
    );
  }

  /**
   * Gets the circuit name for the current request
   *
   * @param {Request} request - The Express request object
   * @returns {string} The circuit name
   */
  private getCircuitName(request: Request): string {
    if (this.options.nameExtractor) {
      return this.options.nameExtractor(request);
    }

    if (this.options.name) {
      return this.options.name;
    }

    // Default: use the route path
    return request.route?.path || request.path;
  }

  /**
   * Default predicate to determine if an error should count as a failure
   * Only counts 5xx errors and network errors as failures
   *
   * @param {Error} error - The error to evaluate
   * @returns {boolean} True if the error should count as a failure
   */
  private defaultIsFailure(error: Error): boolean {
    // Don't count client errors (4xx) as failures
    if (error instanceof HttpException) {
      const status = error.getStatus();
      return status >= 500;
    }

    // Count all other errors (network errors, timeouts, etc.) as failures
    return true;
  }
}
