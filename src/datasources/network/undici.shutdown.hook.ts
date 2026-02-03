import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import type { Agent } from 'undici';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';

export const UndiciAgent = Symbol('UndiciAgent');

@Injectable()
export class UndiciShutdownHook implements OnModuleDestroy {
  constructor(
    @Inject(UndiciAgent)
    private readonly agent: Agent,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  public async onModuleDestroy(): Promise<void> {
    this.loggingService.info('Closing Undici agent connections');
    try {
      await this.agent.close();
      this.loggingService.info('Undici agent connections closed');
    } catch (err) {
      this.loggingService.error(
        `Failed to close Undici agent: ${asError(err).message}`,
      );
    }
  }
}
