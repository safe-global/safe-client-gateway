import { faker } from '@faker-js/faker';
import { ClsService } from 'nestjs-cls';
import * as winston from 'winston';
import { RequestScopedLoggingService } from './logging.service';

const mockClsService = jest.mocked({
  getId: jest.fn(),
} as unknown as ClsService);

const mockLogger = {
  log: jest.fn(),
} as unknown as winston.Logger;

describe('RequestScopedLoggingService', () => {
  const systemTime: Date = faker.date.recent();

  let loggingService: RequestScopedLoggingService;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(systemTime);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    loggingService = new RequestScopedLoggingService(
      mockLogger,
      mockClsService,
    );
  });

  it('info', () => {
    const message = faker.word.words();
    const requestId = faker.string.uuid();
    mockClsService.getId.mockReturnValue(requestId);

    loggingService.info(message);

    expect(mockLogger.log).toHaveBeenCalledTimes(1);
    expect(mockLogger.log).toHaveBeenCalledWith('info', {
      message,
      request_id: requestId,
      timestamp: systemTime.toISOString(),
    });
  });

  it('error', () => {
    const message = faker.word.words();
    const requestId = faker.string.uuid();
    mockClsService.getId.mockReturnValue(requestId);

    loggingService.error(message);

    expect(mockLogger.log).toHaveBeenCalledTimes(1);
    expect(mockLogger.log).toHaveBeenCalledWith('error', {
      message,
      request_id: requestId,
      timestamp: systemTime.toISOString(),
    });
  });

  it('warn', () => {
    const message = faker.word.words();
    const requestId = faker.string.uuid();
    mockClsService.getId.mockReturnValue(requestId);

    loggingService.warn(message);

    expect(mockLogger.log).toHaveBeenCalledTimes(1);
    expect(mockLogger.log).toHaveBeenCalledWith('warn', {
      message,
      request_id: requestId,
      timestamp: systemTime.toISOString(),
    });
  });

  it('debug', () => {
    const message = faker.word.words();
    const requestId = faker.string.uuid();
    mockClsService.getId.mockReturnValue(requestId);

    loggingService.debug(message);

    expect(mockLogger.log).toHaveBeenCalledTimes(1);
    expect(mockLogger.log).toHaveBeenCalledWith('debug', {
      message,
      request_id: requestId,
      timestamp: systemTime.toISOString(),
    });
  });
});
