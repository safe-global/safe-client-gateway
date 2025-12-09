import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { CircuitBreakerService } from '@/datasources/circuit-breaker/circuit-breaker.service';
import type { CircuitBreakerInterceptorOptions } from '@/datasources/circuit-breaker/interfaces/circuit-breaker-interceptor-options.interface';
import type { Request } from 'express';
import { CircuitBreakerException } from '@/datasources/circuit-breaker/exceptions/circuit-breaker.exception';
import { Reflector } from '@nestjs/core';
import { CIRCUIT_BREAKER_OPTIONS_METADATA_KEY } from '@/routes/common/decorators/circuit-breaker.decorator';
import { IConfigurationService } from '@/config/configuration.service.interface';

/**
 * Circuit Breaker Interceptor
 *
 * This interceptor implements the circuit breaker pattern for HTTP endpoints.
 * It monitors request failures and can automatically "trip" to prevent
 * further requests to failing services.
 *
 * Usage 1 - With @CircuitBreaker decorator (recommended):
 * ```typescript
 * @CircuitBreaker('external-api', {
 *   config: { failureThreshold: 3 }
 * })
 * @Get('/data')
 * async getData() {
 *   return await this.externalService.fetch();
 * }
 * ```
 *
 * Usage 2 - Apply at controller level with default options:
 * ```typescript
 * @Controller('users')
 * @UseInterceptors(CircuitBreakerInterceptor)
 * export class UsersController {
 *   @Get('/profile')
 *   async getProfile() { ... }
 * }
 * ```
 *
 * Usage 3 - With custom options via constructor:
 * ```typescript
 * @UseInterceptors(
 *   new CircuitBreakerInterceptor(
 *     circuitBreakerService,
 *     reflector,
 *     { name: 'custom', config: { failureThreshold: 5 } }
 *   )
 * )
 * @Get('/data')
 * async getData() { ... }
 * ```
 *
 * @see https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern
 */

@Injectable()
export class CircuitBreakerInterceptor implements NestInterceptor {
  private readonly DEFAULT_OPEN_CIRCUIT_MESSAGE =
    'Service temporarily unavailable, please try again later!';

  private options: CircuitBreakerInterceptorOptions;
  private isEnabled: boolean;
  /**
   * Creates a new CircuitBreakerInterceptor instance
   *
   * @param {CircuitBreakerService} circuitBreakerService - The circuit breaker service instance (auto-injected by NestJS)
   * @param {Reflector} reflector - Reflector for reading metadata (auto-injected by NestJS)
   */
  public constructor(
    @Inject(CircuitBreakerService)
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly reflector: Reflector,

    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.options = {
      isFailure: (error: Error): boolean => this.isFailure(error),
      openCircuitMessage: this.DEFAULT_OPEN_CIRCUIT_MESSAGE,
    };
    this.isEnabled = this.configurationService.getOrThrow(
      'circuitBreaker.enabled',
    );
  }

  /**
   * Intercepts the request and applies circuit breaker logic
   *
   * @param {ExecutionContext} context - The execution context
   * @param {CallHandler} next - The next handler in the chain
   *
   * @returns {Observable<unknown>} Observable of the response
   */
  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (!this.isEnabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();

    this.options = {
      ...this.options,
      ...this.getOptionsFromMetadata(context),
    };

    const circuitName = this.buildCircuitName(request, this.options);
    this.handleCircuitProceed(circuitName);

    return next.handle().pipe(
      tap(() => this.handleCircuitSuccess(circuitName)),
      catchError((error: Error) => this.handleCircuitError(circuitName, error)),
    );
  }

  /**
   * Retrieves circuit breaker options from metadata set by the @CircuitBreaker decorator
   *
   * @param {ExecutionContext} context - The execution context
   *
   * @returns {Partial<CircuitBreakerInterceptorOptions>} The options from metadata or empty object
   */
  private getOptionsFromMetadata(
    context: ExecutionContext,
  ): Partial<CircuitBreakerInterceptorOptions> {
    return this.reflector.getAllAndOverride<
      Partial<CircuitBreakerInterceptorOptions>
    >(CIRCUIT_BREAKER_OPTIONS_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  /**
   * Builds the circuit name for the current request
   * Uses the name from options if provided, otherwise falls back to the request route path
   *
   * @param {Request} request - The Express request object
   * @param {CircuitBreakerInterceptorOptions} options - Merged options
   *
   * @returns {string} The circuit name
   */
  private buildCircuitName(
    request: Request,
    options: CircuitBreakerInterceptorOptions,
  ): string {
    const requestRoutePath = request.route?.path || request.path;

    return options.name ?? requestRoutePath;
  }

  /**
   * Checks if the circuit allows the request to proceed
   * Throws CircuitBreakerException if the circuit is open
   *
   * @param {string} name - The circuit name
   *
   * @returns {void}
   *
   * @throws {CircuitBreakerException} When the circuit is open
   */
  private handleCircuitProceed(name: string): void {
    if (!this.circuitBreakerService.canProceed(name)) {
      throw new CircuitBreakerException({
        message: this.options.openCircuitMessage,
      });
    }
  }

  /**
   * Records a successful request for the circuit
   * This helps the circuit breaker transition from half-open to closed state
   *
   * @param {string} name - The circuit name
   *
   * @returns {void}
   */
  private handleCircuitSuccess(name: string): void {
    const circuit = this.circuitBreakerService.get(name);
    if (circuit) {
      this.circuitBreakerService.recordSuccess(circuit);
    }
  }

  /**
   * Handles errors from the intercepted request
   * Records failures for qualifying errors and re-throws the original error
   *
   * @param {string} name - The circuit name
   * @param {Error} error - The error that occurred
   *
   * @returns {Observable<never>} Observable that throws the original error
   */
  private handleCircuitError(name: string, error: Error): Observable<never> {
    if (this.options.isFailure(error)) {
      // Circuit is created lazily on first failure (memory optimization)
      const circuit = this.circuitBreakerService.getOrRegisterCircuit(
        name,
        this.options.config,
      );
      this.circuitBreakerService.recordFailure(circuit);
    }

    return throwError(() => error);
  }

  /**
   * Default predicate to determine if an error should count as a failure
   * Only counts 5xx HTTP errors and non-HTTP errors as failures
   * 4xx errors are considered client errors and don't count as service failures
   *
   * @param {Error} error - The error to evaluate
   *
   * @returns {boolean} True if the error should count as a failure
   */
  private isFailure(error: Error): boolean {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      return status >= 500;
    }

    return true;
  }
}
