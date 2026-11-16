// SPDX-License-Identifier: FSL-1.1-MIT
import { type DestinationStream, destination, type Logger, pino } from 'pino';
import PinoPretty from 'pino-pretty';
import type { IConfigurationService } from '#/config/configuration.service.interface';

export const PinoLogger = Symbol('PinoLogger');

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
  return pino(
    {
      level: configurationService.getOrThrow<string>('log.level'),
      enabled: !configurationService.getOrThrow<boolean>('log.silent'),
      messageKey: 'message',
      base: null,
      timestamp: false,
      formatters: {
        level: (label) => ({ level: label }),
      },
    },
    stream ??
      (configurationService.getOrThrow<boolean>('log.prettyColorize')
        ? PinoPretty({ colorize: true, sync: true, messageKey: 'message' })
        : destination({ sync: true })),
  );
}
