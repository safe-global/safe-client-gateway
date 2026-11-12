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
    configurationService.set('log.level', 'debug');
    lines = [];
    stream = {
      write: (line: string): void => {
        lines.push(line);
      },
    };
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

  it('filters messages below the configured level', () => {
    configurationService.set('log.level', 'info');
    const infoMessage = faker.word.words();
    const logger = pinoLoggerFactory(configurationService, stream);

    logger.debug({ message: faker.word.words() });
    logger.info({ message: infoMessage });

    expect(parsedLines()).toStrictEqual([
      { level: 'info', message: infoMessage },
    ]);
  });
});
