import request from 'supertest';
import { Test } from '@nestjs/testing';
import { Controller, UseInterceptors, Get, Injectable } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

import { DeduplicationInterceptor } from '@/routes/common/interceptors/deduplication.interceptor';

@Injectable()
class TestService {
  async fetchData(): Promise<{ message: string }> {
    return new Promise((resolve) => {
      setTimeout(() => resolve({ message: 'Hello, world!' }), 100);
    });
  }
}

@Controller()
@UseInterceptors(DeduplicationInterceptor)
class TestController {
  constructor(private readonly testService: TestService) {}

  @Get('/get')
  async get(): Promise<{ message: string }> {
    return this.testService.fetchData();
  }
}

describe('DeduplicationInterceptor', () => {
  let app: INestApplication<Server>;
  let testService: TestService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [TestController],
      providers: [TestService],
    }).compile();

    app = moduleFixture.createNestApplication();
    testService = moduleFixture.get<TestService>(TestService);

    jest.spyOn(testService, 'fetchData');

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should deduplicate requests', async () => {
    const [response1, response2] = await Promise.all([
      request(app.getHttpServer()).get('/get'),
      request(app.getHttpServer()).get('/get'),
    ]);

    expect(response1.body).toEqual({ message: 'Hello, world!' });
    expect(response2.body).toEqual({ message: 'Hello, world!' });

    expect(testService.fetchData).toHaveBeenCalledTimes(1);
  });

  it('should handle different requests separately', async () => {
    (testService.fetchData as jest.Mock).mockClear();

    const response1 = await request(app.getHttpServer()).get('/get');
    const response2 = await request(app.getHttpServer())
      .get('/get')
      .query({ param: 'value' });

    expect(response1.body).toEqual({ message: 'Hello, world!' });
    expect(response2.body).toEqual({ message: 'Hello, world!' });

    expect(testService.fetchData).toHaveBeenCalledTimes(2);
  });

  it.todo('test all variations of registry key');
});
