// SPDX-License-Identifier: FSL-1.1-MIT
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from 'bun:test';
import { faker } from '@faker-js/faker';
import { context, propagation, trace } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import type { ClsService } from 'nestjs-cls';
import type winston from 'winston';
import { type MockedObject, mocked } from '#/__tests__/mocks';
import type { IConfigurationService } from '#/config/configuration.service.interface';
import { RequestScopedLoggingService } from '#/logging/logging.service';

const mockClsService = mocked({
  getId: jest.fn(),
} as MockedObject<ClsService>);

const mockLogger = {
  log: jest.fn(),
} as MockedObject<winston.Logger>;

const mockConfigurationService = mocked({
  get: jest.fn(),
} as MockedObject<IConfigurationService>);

describe('RequestScopedLoggingService', () => {
  const systemTime: Date = faker.date.recent();
  const buildNumber = faker.string.alphanumeric();
  const version = faker.system.semver();

  let loggingService: RequestScopedLoggingService;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(systemTime);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.resetAllMocks();
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

  it('adds the active trace for Datadog log correlation', () => {
    const provider = new NodeTracerProvider();
    provider.register();
    const message = faker.word.words();
    const requestId = faker.string.uuid();
    mockClsService.getId.mockReturnValue(requestId);

    try {
      trace.getTracer('test').startActiveSpan('request', (span) => {
        const { traceId, spanId } = span.spanContext();

        loggingService.info(message);

        expect(mockLogger.log).toHaveBeenCalledWith('info', {
          message,
          build_number: buildNumber,
          request_id: requestId,
          timestamp: systemTime.toISOString(),
          version: version,
          dd: {
            trace_id: BigInt(`0x${traceId.slice(16)}`).toString(),
            span_id: BigInt(`0x${spanId}`).toString(),
          },
        });
        span.end();
      });
    } finally {
      trace.disable();
      context.disable();
      propagation.disable();
    }
  });
});
