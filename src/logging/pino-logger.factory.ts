// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type DestinationStream,
  destination,
  type Level,
  type Logger,
  pino,
} from 'pino';
import PinoPretty from 'pino-pretty';
import type { IConfigurationService } from '#/config/configuration.service.interface';

export const PinoLogger = Symbol('PinoLogger');

const STDOUT_FD = 1;

/**
 * Maps the configured `log.level` (npm level names) to the Pino level
 * that filters the same set of messages.
 */
function toPinoLevel(level: string): Level {
  switch (level) {
    case 'error':
    case 'warn':
    case 'info':
    case 'debug':
      return level;
    case 'http':
    case 'verbose':
      return 'info';
    case 'silly':
      return 'debug';
    default:
      throw new Error(`Unsupported log level. level=${level}`);
  }
}

/**
 * Provides a Pino logger whose output keeps the structured JSON shape
 * consumed downstream: string `level`, payload under `message` and no
 * `pid`/`hostname`/`time` fields.
 *
 * @param configurationService - the configuration service to retrieve service-level settings
 * @param stream - the destination to write to; defaults to synchronous stdout
 */
export function pinoLoggerFactory(
  configurationService: IConfigurationService,
  stream?: DestinationStream,
): Logger {
  const prettyColorize =
    configurationService.getOrThrow<boolean>('log.prettyColorize');
  return pino(
    {
      level: toPinoLevel(configurationService.getOrThrow<string>('log.level')),
      enabled: !configurationService.getOrThrow<boolean>('log.silent'),
      messageKey: 'message',
      base: null,
      timestamp: false,
      formatters: {
        level: (label) => ({ level: label }),
      },
    },
    stream ??
      (prettyColorize
        ? PinoPretty({ colorize: true, sync: true, messageKey: 'message' })
        : destination({ fd: STDOUT_FD, sync: true })),
  );
}
