// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { ClsService } from 'nestjs-cls';
import type { Logger } from 'pino';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '#/config/configuration.service.interface';
import { RequestScopedLoggingService } from '#/logging/logging.service';

const mockClsService = vi.mocked({
  getId: vi.fn(),
} as MockedObject<ClsService>);

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as unknown as MockedObject<Logger>;

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

  afterAll(() => {
    vi.useRealTimers();
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

    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith({
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

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith({
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

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith({
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

    expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith({
      message,
      build_number: buildNumber,
      request_id: requestId,
      timestamp: systemTime.toISOString(),
      version: version,
    });
  });

  it('logs the message and enumerable properties of an Error', () => {
    const level = faker.helpers.arrayElement([
      'info',
      'error',
      'warn',
      'debug',
    ] as const);
    const errorMessage = faker.word.words();
    const code = faker.number.int();
    const error = Object.assign(new Error(errorMessage), { code });
    const requestId = faker.string.uuid();
    mockClsService.getId.mockReturnValue(requestId);

    loggingService[level](error);

    expect(mockLogger[level]).toHaveBeenCalledTimes(1);
    expect(mockLogger[level]).toHaveBeenCalledWith({
      message: errorMessage,
      code,
      build_number: buildNumber,
      request_id: requestId,
      timestamp: systemTime.toISOString(),
      version: version,
    });
  });
});
