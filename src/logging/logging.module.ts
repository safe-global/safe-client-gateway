// SPDX-License-Identifier: FSL-1.1-MIT
import { Global, Module } from '@nestjs/common';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { LoggingService } from '#/logging/logging.interface';
import { RequestScopedLoggingService } from '#/logging/logging.service';
import { PinoLogger, pinoLoggerFactory } from '#/logging/pino-logger.factory';

/**
 * Module for logging messages throughout the application.
 *
 * Provides the RequestScopedLoggingService which logs the current time and request ID with every message.
 */
@Global()
@Module({
  providers: [
    { provide: LoggingService, useClass: RequestScopedLoggingService },
    {
      provide: PinoLogger,
      useFactory: pinoLoggerFactory,
      inject: [IConfigurationService],
    },
  ],
  exports: [LoggingService],
})
export class RequestScopedLoggingModule {}
