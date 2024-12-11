import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { createHash } from 'crypto';

/**
 * This interceptor can be used to deduplicate requests based on their
 * method, protocol, hostname, URL, query, headers, and body.
 */
@Injectable()
export class DeduplicationInterceptor implements NestInterceptor {
  private registry = new Map<string, Promise<unknown>>();

  /**
   * Intercepts the request and checks if a request with the same properties
   * is pending. If it is, it waits for the pending request to finish and
   * returns its result. If it is not, it registers the request and waits
   * for the result.
   *
   * @param context - {@link ExecutionContext} instance
   * @param next - {@link CallHandler} instance
   * @returns an {@link Observable} that emits the result of the request.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request: Request = context.switchToHttp().getRequest();
    const key = this.getRegistryKey(request);

    return new Observable((observer) => {
      this.getOrRegister(key, () => next.handle().toPromise())
        .then((result) => {
          observer.next(result);
          observer.complete();
        })
        .catch((err) => {
          observer.error(err);
        });
    });
  }

  /**
   * Returns a promise that resolves to the result of the provided function.
   * If a promise with the same key is already pending, it returns that
   * promise, otherwise it registers the promise and returns it.
   */
  async getOrRegister<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.registry.has(key)) {
      return this.registry.get(key) as Promise<T>;
    }

    const promise = fn().finally(() => {
      this.registry.delete(key);
    });

    this.registry.set(key, promise);

    return promise;
  }

  /**
   * Generates a unique key for the request based on its method, protocol,
   * hostname, URL, query, headers, and body.
   *
   * @param request - {@link Request} instance
   * @returns a unique key for the request.
   */
  private getRegistryKey(request: Request): string {
    const { method, protocol, hostname, url, query, headers, body } = request;

    const stringifiedQuery = JSON.stringify(query);
    const stringifiedHeaders = JSON.stringify(headers);
    const stringifiedBody = JSON.stringify(body);

    const key = `${method}_${protocol}_${hostname}_${url}_${stringifiedQuery}_${stringifiedHeaders}_${stringifiedBody}`;
    return createHash('sha256').update(key).digest('hex');
  }
}
