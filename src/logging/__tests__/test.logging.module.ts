import { Global, Module } from '@nestjs/common';
import { ILoggingService, LoggingService } from '../logging.interface';

const loggerService: ILoggingService = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
};

const mockLoggerService = jest.mocked(loggerService);

@Global()
@Module({
  providers: [{ provide: LoggingService, useValue: mockLoggerService }],
  exports: [LoggingService],
})
export class TestLoggingModule {}
