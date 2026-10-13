// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { DestinationStream } from 'pino';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import { pinoLoggerFactory } from '#/logging/pino-logger.factory';

const LOG_LEVELS = ['info', 'warn', 'error', 'debug'] as const;

describe('pinoLoggerFactory', () => {
  let configurationService: FakeConfigurationService;
  let lines: Array<string>;
  let stream: DestinationStream;

  beforeEach(() => {
    configurationService = new FakeConfigurationService();
    configurationService.set('log.silent', false);
    configurationService.set('log.prettyColorize', false);
    configurationService.set('log.level', 'debug');
    lines = [];
    stream = { write: (line: string): void => void lines.push(line) };
  });

  function parsedLines(): Array<unknown> {
    return lines.map((line) => JSON.parse(line));
  }

  it('logs the level as a label and the payload under message without pid, hostname or time', () => {
    const level = faker.helpers.arrayElement(LOG_LEVELS);
    const entry = {
      message: faker.word.words(),
      build_number: faker.string.alphanumeric(),
      request_id: faker.string.uuid(),
      timestamp: faker.date.recent().toISOString(),
      version: faker.system.semver(),
    };
    const logger = pinoLoggerFactory(configurationService, stream);

    logger[level](entry);

    expect(parsedLines()).toStrictEqual([{ level, ...entry }]);
  });

  it('serializes object payloads as-is', () => {
    const level = faker.helpers.arrayElement(LOG_LEVELS);
    const message = {
      status_code: faker.internet.httpStatusCode(),
      detail: faker.word.words(),
      route: faker.system.directoryPath(),
    };
    const logger = pinoLoggerFactory(configurationService, stream);

    logger[level]({ message });

    expect(parsedLines()).toStrictEqual([{ level, message }]);
  });

  it('omits undefined fields', () => {
    const level = faker.helpers.arrayElement(LOG_LEVELS);
    const message = faker.word.words();
    const logger = pinoLoggerFactory(configurationService, stream);

    logger[level]({ message, version: undefined });

    expect(parsedLines()).toStrictEqual([{ level, message }]);
  });

  it('writes nothing when silent', () => {
    configurationService.set('log.silent', true);
    const level = faker.helpers.arrayElement(LOG_LEVELS);
    const logger = pinoLoggerFactory(configurationService, stream);

    logger[level]({ message: faker.word.words() });

    expect(lines).toHaveLength(0);
  });

  it.each([
    ['info', false],
    ['http', false],
    ['verbose', false],
    ['debug', true],
    ['silly', true],
  ])(
    'filters debug messages for the %s level as before (debug logged: %s)',
    (level, isDebugLogged) => {
      configurationService.set('log.level', level);
      const debugMessage = faker.word.words();
      const infoMessage = faker.word.words();
      const logger = pinoLoggerFactory(configurationService, stream);

      logger.debug({ message: debugMessage });
      logger.info({ message: infoMessage });

      expect(parsedLines()).toStrictEqual([
        ...(isDebugLogged ? [{ level: 'debug', message: debugMessage }] : []),
        { level: 'info', message: infoMessage },
      ]);
    },
  );

  it('throws for an unsupported level', () => {
    const level = faker.string.alpha({ length: 12 });
    configurationService.set('log.level', level);

    expect(() => pinoLoggerFactory(configurationService, stream)).toThrow(
      `Unsupported log level. level=${level}`,
    );
  });
});
