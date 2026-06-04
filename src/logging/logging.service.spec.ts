import { faker } from '@faker-js/faker';
import type { ClsService } from 'nestjs-cls';
import type { MockedObject } from 'vitest';
import type winston from 'winston';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { RequestScopedLoggingService } from '@/logging/logging.service';

const mockClsService = vi.mocked({
  getId: vi.fn(),
} as MockedObject<ClsService>);

const mockLogger = {
  log: vi.fn(),
} as MockedObject<winston.Logger>;

const mockConfigurationService = vi.mocked({
  get: vi.fn(),
} as MockedObject<IConfigurationService>);

describe('RequestScopedLoggingService', () => {
  const systemTime: Date = faker.date.recent();
  const buildNumber = faker.string.alphanumeric();
  const version = faker.system.semver();

  let loggingService: RequestScopedLoggingService;

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(systemTime);
  });

  beforeEach(() => {
    vi.resetAllMocks();
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
    mockClsService.getId.mockReturnValue(requestId);

    loggingService.info(message);

    expect(mockLogger.log).toHaveBeenCalledTimes(1);
    expect(mockLogger.log).toHaveBeenCalledWith('info', {
      message,
      build_number: buildNumber,
      request_id: requestId,
      timestamp: systemTime.toISOString(),
      version: version,
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
      build_number: buildNumber,
      request_id: requestId,
      timestamp: systemTime.toISOString(),
      version: version,
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
      build_number: buildNumber,
      request_id: requestId,
      timestamp: systemTime.toISOString(),
      version: version,
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
      build_number: buildNumber,
      request_id: requestId,
      timestamp: systemTime.toISOString(),
      version: version,
    });
  });
});
