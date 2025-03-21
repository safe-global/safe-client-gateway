import { faker } from '@faker-js/faker';
import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  INestApplication,
  Post,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import request from 'supertest';
import { APP_FILTER } from '@nestjs/core';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { ConfigurationModule } from '@/config/configuration.module';
import configuration from '@/config/entities/__tests__/configuration';
import { GlobalErrorFilter } from '@/routes/common/filters/global-error.filter';
import { Server } from 'net';
import { HttpExceptionNoLog } from '@/domain/common/errors/http-exception-no-log.error';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

@Controller({})
class TestController {
  @Post('http-exception')
  httpException(@Body() body: { code: HttpStatus }): void {
    throw new HttpException({ message: 'Some http exception' }, body.code);
  }

  @Post('no-log-http-exception')
  noLogHttpException(@Body() body: { code: HttpStatus }): void {
    throw new HttpExceptionNoLog('Some no log http exception', body.code);
  }

  @Get('non-http-exception')
  nonHttpException(): void {
    throw new Error('Some random error');
  }
}

describe('GlobalErrorFilter tests', () => {
  let app: INestApplication<Server>;
  let loggingService: ILoggingService;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestLoggingModule, ConfigurationModule.register(configuration)],
      controllers: [TestController],
      providers: [
        {
          provide: APP_FILTER,
          useClass: GlobalErrorFilter,
        },
      ],
    }).compile();
    loggingService = moduleFixture.get<ILoggingService>(LoggingService);

    // TODO: Override service so as to not spy
    jest.spyOn(loggingService, 'error');
    jest.spyOn(loggingService, 'info');

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('responses', () => {
    it('http exception returns correct error code and message', async () => {
      const code = faker.helpers.arrayElement([422, 502]);

      await request(app.getHttpServer())
        .post('/http-exception')
        .send({ code })
        .expect(code)
        .expect({ message: 'Some http exception' });
    });

    it('no log http exception returns correct error code and message', async () => {
      const code = faker.helpers.arrayElement([422, 502]);

      await request(app.getHttpServer())
        .post('/no-log-http-exception')
        .send({ code })
        .expect(code)
        .expect({ message: 'Some no log http exception', statusCode: code });
    });

    it('non http exception returns correct error code and message', async () => {
      await request(app.getHttpServer())
        .get('/non-http-exception')
        .expect(500)
        .expect({
          code: 500,
          message: 'Internal server error',
        });
    });
  });

  describe('logs', () => {
    it('should log server errors as errors', async () => {
      const code = 502;

      await request(app.getHttpServer())
        .post('/http-exception')
        .send({ code })
        .expect(code);

      expect(loggingService.info).not.toHaveBeenCalled();
      expect(loggingService.error).toHaveBeenCalledTimes(1);
      expect(loggingService.error).toHaveBeenNthCalledWith(1, {
        name: 'HttpException',
        message: 'Some http exception',
        stacktrace: expect.any(String),
      });
    });

    it('should log non-server errors as info', async () => {
      const code = 422;

      await request(app.getHttpServer())
        .post('/http-exception')
        .send({ code })
        .expect(code);

      expect(loggingService.error).not.toHaveBeenCalled();
      expect(loggingService.info).toHaveBeenCalledTimes(1);
      expect(loggingService.info).toHaveBeenNthCalledWith(1, {
        name: 'HttpException',
        message: 'Some http exception',
        stacktrace: expect.any(String),
      });
    });

    it('should not log no log http exception', async () => {
      const code = faker.helpers.arrayElement([422, 502]);

      await request(app.getHttpServer())
        .post('/no-log-http-exception')
        .send({ code })
        .expect(code);

      expect(loggingService.info).not.toHaveBeenCalled();
      expect(loggingService.error).not.toHaveBeenCalled();
    });
  });
});
