// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import {
  type CallHandler,
  Controller,
  type ExecutionContext,
  Get,
  type INestApplication,
  Injectable,
  type NestInterceptor,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { FastifyReply } from 'fastify';
// biome-ignore lint/suspicious/noDeprecatedImports: only multi-callback `tap` overloads are deprecated in rxjs; we use the single-observer signature.
import { type Observable, tap } from 'rxjs';
import request from 'supertest';
import {
  createTestApplication,
  initTestApplication,
} from '@/__tests__/test-app.provider';
import { CacheControlInterceptor } from '@/routes/common/interceptors/cache-control.interceptor';

/**
 * Stands in for a route-level interceptor that opts into client caching, to
 * assert the global default does not overwrite it.
 */
@Injectable()
class SetsCacheControlInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap(() => {
        context
          .switchToHttp()
          .getResponse<FastifyReply>()
          .header('Cache-Control', 'private, max-age=30');
      }),
    );
  }
}

@Controller()
@UseInterceptors(CacheControlInterceptor)
class TestController {
  @Get()
  test(): void {
    return;
  }

  @Get('headers-sent')
  withHeader(@Res() res: FastifyReply): void {
    res.header('Cache-Control', 'public');
    res.send();
    return;
  }

  @Get('header-already-set')
  @UseInterceptors(SetsCacheControlInterceptor)
  headerAlreadySet(): void {
    return;
  }
}

describe('CacheControlInterceptor tests', () => {
  let app: INestApplication<Server>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();

    app = createTestApplication(module);
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app?.close();
  });

  it('should set the Cache-Control header to no-cache', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect('Cache-Control', 'no-cache');
  });

  it('should not set the Cache-Control header to no-cache if the headers have been set', () => {
    return request(app.getHttpServer())
      .get('/headers-sent')
      .expect('Cache-Control', 'public');
  });

  it('should not overwrite a Cache-Control header set by a route-level interceptor', () => {
    return request(app.getHttpServer())
      .get('/header-already-set')
      .expect('Cache-Control', 'private, max-age=30');
  });
});
