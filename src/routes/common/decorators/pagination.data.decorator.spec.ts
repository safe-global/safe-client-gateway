import { PaginationDataDecorator } from './pagination.data.decorator';
import { PaginationData } from '../pagination/pagination.data';
import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { fakeCacheService } from '../../../datasources/cache/__tests__/test.cache.module';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

describe('PaginationDataDecorator', () => {
  let app: INestApplication;
  let paginationData;

  @Controller()
  class TestController {
    @Get()
    route(@PaginationDataDecorator() data?: PaginationData) {
      paginationData = data;
      return;
    }
  }

  @Module({ controllers: [TestController] })
  class TestModule {}

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeCacheService.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('no cursor', async () => {
    await request(app.getHttpServer())
      .get('')
      .query('some_param=test')
      .expect(200);

    expect(paginationData.limit).toBe(undefined);
    expect(paginationData.offset).toBe(undefined);
  });

  it('with cursor', async () => {
    await request(app.getHttpServer())
      .get('')
      .query('cursor=limit%3D1%26offset%3D0')
      .expect(200);

    expect(paginationData.limit).toBe(1);
    expect(paginationData.offset).toBe(0);
  });
});
