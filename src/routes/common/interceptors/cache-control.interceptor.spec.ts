import {
  Controller,
  Get,
  INestApplication,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { CacheControlInterceptor } from '@/routes/common/interceptors/cache-control.interceptor';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'net';
import { Response } from 'express';
import { ResponseCacheService } from '@/datasources/cache/response-cache.service';

@Controller()
@UseInterceptors(CacheControlInterceptor)
class TestController {
  @Get()
  test(): { status: string } {
    return { status: 'ok' };
  }

  @Get('headers-sent')
  withHeader(@Res() res: Response): void {
    res.setHeader('Cache-Control', 'public');
    res.send();
    return;
  }
}

describe('CacheControlInterceptor tests', () => {
  let app: INestApplication<Server>;
  const responseCacheService = {
    getTtl: jest.fn(),
    trackTtl: jest.fn(),
  } as unknown as jest.Mocked<ResponseCacheService>;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TestController],
      providers: [
        CacheControlInterceptor,
        { provide: ResponseCacheService, useValue: responseCacheService },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('should set the Cache-Control header to no-cache', () => {
    responseCacheService.getTtl.mockReturnValueOnce(undefined);
    return request(app.getHttpServer())
      .get('/')
      .expect('Cache-Control', 'no-cache');
  });

  it('should set cache headers when ttl is available', async () => {
    const ttl = 60;
    responseCacheService.getTtl.mockReturnValueOnce(ttl);

    const response = await request(app.getHttpServer()).get('/');

    expect(response.headers['cache-control']).toBe(
      `public, max-age=${ttl}, must-revalidate`,
    );
    expect(response.headers.expires).toBeDefined();
    expect(response.headers.etag).toBeDefined();
  });

  it('should not set the Cache-Control header to no-cache if the headers have been set', () => {
    responseCacheService.getTtl.mockReturnValueOnce(undefined);
    return request(app.getHttpServer())
      .get('/headers-sent')
      .expect('Cache-Control', 'public');
  });
});
