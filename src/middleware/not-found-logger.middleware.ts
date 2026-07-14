// SPDX-License-Identifier: FSL-1.1-MIT

import type { ServerResponse } from 'node:http';
import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { formatRouteLogMessage } from '@/logging/utils';
import type { RequestLike } from '@/routes/common/http/http-request.utils';

/**
 * Middleware which logs requests that resulted in 404. Request side effects
 * that are not tied to any route can be handled here.
 *
 * Since a 404 can be triggered by non-existing routes,
 * the {@link RouteLoggerInterceptor} might never be triggered because there
 * are no routes to handle this request.
 */
@Injectable()
export class NotFoundLoggerMiddleware implements NestMiddleware {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  use(
    // `@fastify/middie` runs this on the raw Node request and adds `originalUrl`;
    // `RequestLike` is the shared shape `formatRouteLogMessage` consumes.
    req: RequestLike,
    res: ServerResponse,
    next: (error?: Error) => void,
  ): void {
    const startTimeMs: number = performance.now();

    res.once('finish', () => {
      const { statusCode } = res;
      if (statusCode === 404) {
        this.loggingService.info(
          formatRouteLogMessage(statusCode, req, startTimeMs),
        );
      }
    });

    next();
  }
}
