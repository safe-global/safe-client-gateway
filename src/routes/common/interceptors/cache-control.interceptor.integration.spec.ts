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

@Controller()
@UseInterceptors(CacheControlInterceptor)
class TestController {
  @Get()
  test(): void {
    return;
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

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();

    app = module.createNestApplication();
    await app.init();
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
