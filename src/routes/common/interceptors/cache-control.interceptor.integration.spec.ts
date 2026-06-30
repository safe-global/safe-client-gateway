// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import {
  Controller,
  Get,
  type INestApplication,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { FastifyReply } from 'fastify';
import request from 'supertest';
import {
  createTestApplication,
  initTestApplication,
} from '@/__tests__/test-app.provider';
import { CacheControlInterceptor } from '@/routes/common/interceptors/cache-control.interceptor';

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
    await app.close();
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
});
