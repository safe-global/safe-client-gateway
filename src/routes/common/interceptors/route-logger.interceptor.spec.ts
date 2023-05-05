import { RouteLoggerInterceptor } from './route-logger.interceptor';
import { ILoggingService } from '../../../logging/logging.interface';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  INestApplication,
} from '@nestjs/common';
import * as request from 'supertest';

const mockLoggingService = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as unknown as ILoggingService;

@Controller({ path: 'test' })
class TestController {
  @Get('server-error')
  getServerError() {
    throw new HttpException('Some 500 error', HttpStatus.INTERNAL_SERVER_ERROR);
  }

  @Get('server-error-non-http')
  getNonHttpError() {
    throw new Error('Some random error');
  }

  @Get('client-error')
  getClientError() {
    throw new HttpException('Some 400 error', HttpStatus.METHOD_NOT_ALLOWED);
  }

  @Get('success')
  getSuccess() {
    return;
  }
}

describe('RouteLoggerInterceptor tests', () => {
  let app: INestApplication;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();

    app = await moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new RouteLoggerInterceptor(mockLoggingService));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('500 error triggers error level', async () => {
    await request(app.getHttpServer()).get('/test/server-error').expect(500);

    expect(mockLoggingService.error).toBeCalledTimes(1);
    expect(mockLoggingService.error).toBeCalledWith({
      client_ip: null,
      detail: 'Some 500 error',
      method: 'GET',
      path: '/test/server-error',
      response_time_ms: expect.any(Number),
      route: '/test/server-error',
      status_code: 500,
    });
    expect(mockLoggingService.info).not.toBeCalled();
    expect(mockLoggingService.debug).not.toBeCalled();
    expect(mockLoggingService.warn).not.toBeCalled();
  });

  it('400 error triggers info level', async () => {
    await request(app.getHttpServer()).get('/test/client-error').expect(405);

    expect(mockLoggingService.info).toBeCalledTimes(1);
    expect(mockLoggingService.info).toBeCalledWith({
      client_ip: null,
      detail: 'Some 400 error',
      method: 'GET',
      path: '/test/client-error',
      response_time_ms: expect.any(Number),
      route: '/test/client-error',
      status_code: 405,
    });
    expect(mockLoggingService.error).not.toBeCalled();
    expect(mockLoggingService.debug).not.toBeCalled();
    expect(mockLoggingService.warn).not.toBeCalled();
  });

  it('200 triggers info level', async () => {
    await request(app.getHttpServer()).get('/test/success').expect(200);

    expect(mockLoggingService.info).toBeCalledTimes(1);
    expect(mockLoggingService.info).toBeCalledWith({
      client_ip: null,
      detail: null,
      method: 'GET',
      path: '/test/success',
      response_time_ms: expect.any(Number),
      route: '/test/success',
      status_code: 200,
    });
    expect(mockLoggingService.error).not.toBeCalled();
    expect(mockLoggingService.debug).not.toBeCalled();
    expect(mockLoggingService.warn).not.toBeCalled();
  });

  it('non http error triggers error level', async () => {
    await request(app.getHttpServer())
      .get('/test/server-error-non-http')
      .expect(500);

    expect(mockLoggingService.error).toBeCalledTimes(1);
    expect(mockLoggingService.error).toBeCalledWith({
      client_ip: null,
      detail: 'Some random error',
      method: 'GET',
      path: '/test/server-error-non-http',
      response_time_ms: expect.any(Number),
      route: '/test/server-error-non-http',
      status_code: 500,
    });
    expect(mockLoggingService.info).not.toBeCalled();
    expect(mockLoggingService.debug).not.toBeCalled();
    expect(mockLoggingService.warn).not.toBeCalled();
  });
});
