import { Global, Inject, Module } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

class TestLoggingService implements ILoggingService {
  private readonly isSilent: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.isSilent = configurationService.getOrThrow<boolean>('log.silent');
  }

  debug(message: string | unknown): void {
    if (this.isSilent) return;
    console.debug(message);
  }

  error(message: string | unknown): void {
    if (this.isSilent) return;
    console.error(message);
  }

  info(message: string | unknown): void {
    if (this.isSilent) return;
    console.info(message);
  }

  warn(message: string | unknown): void {
    if (this.isSilent) return;
    console.warn(message);
  }
}

@Global()
@Module({
  providers: [{ provide: LoggingService, useClass: TestLoggingService }],
  exports: [LoggingService],
})
export class TestLoggingModule {}
