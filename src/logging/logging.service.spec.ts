import { faker } from '@faker-js/faker';
import { ClsService } from 'nestjs-cls';
import * as winston from 'winston';
import { RequestScopedLoggingService } from './logging.service';
import { IConfigurationService } from '@/config/configuration.service.interface';

const mockClsService = jest.mocked({
  getId: jest.fn(),
  get: jest.fn(),
} as unknown as ClsService);

const mockLogger = {
  log: jest.fn(),
} as unknown as winston.Logger;

const mockConfigurationService = jest.mocked({
  get: jest.fn(),
} as unknown as IConfigurationService);

describe('RequestScopedLoggingService', () => {
  const systemTime: Date = faker.date.recent();
  const buildNumber = faker.string.alphanumeric();
  const version = faker.system.semver();

  let loggingService: RequestScopedLoggingService;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(systemTime);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigurationService.get.mockImplementation((key) => {
      switch (key) {
        case 'about.version':
          return version;
        case 'about.buildNumber':
          return buildNumber;
        default:
          throw Error(`No value set for key ${key}`);
      }
    });
    loggingService = new RequestScopedLoggingService(
      mockConfigurationService,
      mockLogger,
      mockClsService,
    );
  });

  it('info', () => {
    const message = faker.word.words();
    const requestId = faker.string.uuid();
    const safeAppUserAgent = faker.word.sample();
    mockClsService.getId.mockReturnValue(requestId);
    mockClsService.get.mockReturnValue(safeAppUserAgent);

    loggingService.info(message);

    expect(mockLogger.log).toHaveBeenCalledTimes(1);
    expect(mockLogger.log).toHaveBeenCalledWith('info', {
      message,
      build_number: buildNumber,
      request_id: requestId,
      safe_app_user_agent: safeAppUserAgent,
      timestamp: systemTime.toISOString(),
      version: version,
    });
  });

  it('error', () => {
    const message = faker.word.words();
    const requestId = faker.string.uuid();
    const safeAppUserAgent = faker.word.sample();
    mockClsService.getId.mockReturnValue(requestId);
    mockClsService.get.mockReturnValue(safeAppUserAgent);

    loggingService.error(message);

    expect(mockLogger.log).toHaveBeenCalledTimes(1);
    expect(mockLogger.log).toHaveBeenCalledWith('error', {
      message,
      build_number: buildNumber,
      request_id: requestId,
      safe_app_user_agent: safeAppUserAgent,
      timestamp: systemTime.toISOString(),
      version: version,
    });
  });

  it('warn', () => {
    const message = faker.word.words();
    const requestId = faker.string.uuid();
    const safeAppUserAgent = faker.word.sample();
    mockClsService.getId.mockReturnValue(requestId);
    mockClsService.get.mockReturnValue(safeAppUserAgent);

    loggingService.warn(message);

    expect(mockLogger.log).toHaveBeenCalledTimes(1);
    expect(mockLogger.log).toHaveBeenCalledWith('warn', {
      message,
      build_number: buildNumber,
      request_id: requestId,
      safe_app_user_agent: safeAppUserAgent,
      timestamp: systemTime.toISOString(),
      version: version,
    });
  });

  it('debug', () => {
    const message = faker.word.words();
    const requestId = faker.string.uuid();
    const safeAppUserAgent = faker.word.sample();
    mockClsService.getId.mockReturnValue(requestId);
    mockClsService.get.mockReturnValue(safeAppUserAgent);

    loggingService.debug(message);

    expect(mockLogger.log).toHaveBeenCalledTimes(1);
    expect(mockLogger.log).toHaveBeenCalledWith('debug', {
      message,
      build_number: buildNumber,
      request_id: requestId,
      safe_app_user_agent: safeAppUserAgent,
      timestamp: systemTime.toISOString(),
      version: version,
    });
  });
});
