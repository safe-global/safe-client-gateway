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
  beforeEach(() => {
    jest.resetAllMocks();

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
  });

  const transports = winstonTransportsFactory(mockConfigurationService);
  const logger = winstonFactory(transports, mockConfigurationService);

  it('logs string message', () => {
    jest.spyOn(winston.transports.Console.prototype, 'log');
    const level = faker.helpers.arrayElement([
      'info',
      'warn',
      'error',
      'debug',
    ]);
    const message = faker.word.words();

    logger.log(level, { message });

    expect(winston.transports.Console.prototype.log).toHaveBeenCalledTimes(1);
    expect(winston.transports.Console.prototype.log).toHaveBeenNthCalledWith(
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
    jest.spyOn(winston.transports.Console.prototype, 'log');
    const level = faker.helpers.arrayElement([
      'info',
      'warn',
      'error',
      'debug',
    ]);
    const message = faker.word.words();

    logger.log(level, { message: new Error(message) });

    expect(winston.transports.Console.prototype.log).toHaveBeenCalledTimes(1);
    expect(winston.transports.Console.prototype.log).toHaveBeenNthCalledWith(
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
