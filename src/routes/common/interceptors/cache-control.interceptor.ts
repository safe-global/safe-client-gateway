import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * This interceptor can be used to set the `Cache-Control` header to `no-cache`.
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> | Promise<Observable<unknown>> {
    return next.handle().pipe(
      tap(() => {
        const response: Response = context.switchToHttp().getResponse();
        response.header('Cache-Control', 'no-cache');
      }),
    );
  }
}
