import { Global, Module } from '@nestjs/common';
import { LoggingService } from './logging.interface';
import { RequestScopedLoggingService } from './logging.service';
import * as winston from 'winston';
import * as Transport from 'winston-transport';
import { Logger } from './logger.symbol';

/**
 * Provides a new instance of a Winston logger using the provided {@link transports}
 *
 * @param transports - the logger transports to be used in the winston instance
 */
function winstonFactory(transports: Transport[] | Transport): winston.Logger {
  return winston.createLogger({ transports: transports });
}

const LoggerTransports = Symbol('LoggerTransports');

/**
 * Factory which provides a collection of transports to be used by the
 * logger instance
 */
function winstonTransportsFactory(): Transport[] | Transport {
  return new winston.transports.Console({
    level: 'debug',
    format: winston.format.json(),
  });
}

/**
 * Module for logging messages throughout the application.
 *
 * Provides the RequestScopedLoggingService which logs the current time and request ID with every message.
 */
@Global()
@Module({
  providers: [
    { provide: LoggingService, useClass: RequestScopedLoggingService },
    { provide: LoggerTransports, useFactory: winstonTransportsFactory },
    {
      provide: Logger,
      useFactory: winstonFactory,
      inject: [LoggerTransports],
    },
  ],
  exports: [LoggingService],
})
export class RequestScopedLoggingModule {}
