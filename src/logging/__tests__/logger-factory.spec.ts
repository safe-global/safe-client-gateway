import { faker } from '@faker-js/faker';
import {
  winstonFactory,
  winstonTransportsFactory,
} from '@/logging/logging.module';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import winston from 'winston';

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

describe('logger factory', () => {
  let consoleSpy: jest.SpyInstance;
  let logger: winston.Logger;

  beforeEach(() => {
    jest.resetAllMocks();

    consoleSpy = jest.spyOn(winston.transports.Console.prototype, 'log');
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      switch (key) {
        case 'log.silent': {
          return false;
        }
        case 'log.prettyColorize': {
          return false;
        }
        case 'log.level': {
          return 'debug';
        }
        default: {
          throw Error(`No value set for key. key=${key}`);
        }
      }
    });
    const transports = winstonTransportsFactory(mockConfigurationService);
    logger = winstonFactory(transports, mockConfigurationService);
  });

  it('logs string message', () => {
    const level = faker.helpers.arrayElement([
      'info',
      'warn',
      'error',
      'debug',
    ]);
    const message = faker.word.words();

    logger.log(level, { message });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenNthCalledWith(
      1,
      {
        level,
        message,
        [Symbol.for('level')]: level,
        [Symbol.for('message')]: JSON.stringify({
          level,
          message,
        }),
      },
      expect.any(Function),
    );
  });

  it('logs Error message', () => {
    const level = faker.helpers.arrayElement([
      'info',
      'warn',
      'error',
      'debug',
    ]);
    const message = faker.word.words();

    logger.log(level, { message: new Error(message) });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenNthCalledWith(
      1,
      {
        level,
        // Error message is serialized to string
        message,
        [Symbol.for('level')]: level,
        [Symbol.for('message')]: JSON.stringify({
          level,
          message,
        }),
      },
      expect.any(Function),
    );
  });
});
