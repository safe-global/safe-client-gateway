import {
  Controller,
  Get,
  INestApplication,
  UseInterceptors,
} from '@nestjs/common';
import { CacheControlInterceptor } from '@/routes/common/interceptors/cache-control.interceptor';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'net';

@Controller()
@UseInterceptors(CacheControlInterceptor)
class TestController {
  @Get()
  test(): void {
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
});
