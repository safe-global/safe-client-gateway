import { Global, Module } from '@nestjs/common';
import { ILoggingService, LoggingService } from '../logging.interface';

const loggingService: ILoggingService = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
};

const mockLoggingService = jest.mocked(loggingService);

@Global()
@Module({
  providers: [{ provide: LoggingService, useValue: mockLoggingService }],
  exports: [LoggingService],
})
export class TestLoggingModule {}
