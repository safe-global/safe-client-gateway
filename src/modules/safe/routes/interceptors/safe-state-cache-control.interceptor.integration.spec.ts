// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import {
  Controller,
  Get,
  type INestApplication,
  UseInterceptors,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  createTestApplication,
  initTestApplication,
} from '@/__tests__/test-app.provider';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { SafeStateCacheControlInterceptor } from '@/modules/safe/routes/interceptors/safe-state-cache-control.interceptor';
import { CacheControlInterceptor } from '@/routes/common/interceptors/cache-control.interceptor';

const MAX_AGE_KEY = 'clientCacheControl.safeStateMaxAgeSeconds';

/**
 * Mirrors production wiring: the opt-in interceptor sits on a single handler
 * while `CacheControlInterceptor` is global, so the global one is the outermost
 * and its `tap` runs last.
 */
@Controller()
class TestController {
  @Get('safe-state')
  @UseInterceptors(SafeStateCacheControlInterceptor)
  getSafeState(): void {
    return;
  }

  @Get('other')
  getOther(): void {
    return;
  }
}

describe('SafeStateCacheControlInterceptor tests', () => {
  let app: INestApplication<Server>;

  const createApp = async (maxAgeSeconds: number): Promise<void> => {
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(MAX_AGE_KEY, maxAgeSeconds);

    const module = await Test.createTestingModule({
      controllers: [TestController],
      providers: [
        {
          provide: IConfigurationService,
          useValue: fakeConfigurationService,
        },
        SafeStateCacheControlInterceptor,
        {
          provide: APP_INTERCEPTOR,
          useClass: CacheControlInterceptor,
        },
      ],
    }).compile();

    app = createTestApplication(module);
    await initTestApplication(app);
  };

  afterEach(async () => {
    await app?.close();
  });

  it('should let clients cache the response for the configured max-age', async () => {
    await createApp(30);

    await request(app.getHttpServer())
      .get('/safe-state')
      .expect('Cache-Control', 'private, max-age=30');
  });

  it('should not be overwritten by the global no-cache default', async () => {
    await createApp(45);

    const response = await request(app.getHttpServer()).get('/safe-state');

    expect(response.headers['cache-control']).toBe('private, max-age=45');
  });

  it('should fall back to no-cache when the max-age is zero', async () => {
    await createApp(0);

    await request(app.getHttpServer())
      .get('/safe-state')
      .expect('Cache-Control', 'no-cache');
  });

  it('should leave routes that did not opt in on no-cache', async () => {
    await createApp(30);

    await request(app.getHttpServer())
      .get('/other')
      .expect('Cache-Control', 'no-cache');
  });
});
