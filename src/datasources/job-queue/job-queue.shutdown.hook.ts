import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';

@Injectable()
export class JobQueueShutdownHook implements OnModuleDestroy {
  constructor(
    private readonly queue: Queue,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  public async onModuleDestroy(): Promise<void> {
    this.loggingService.info(
      `Closing connection to jobs queue: ${this.queue.name}`,
    );
    try {
      await this.queue.close();
      this.loggingService.info(
        `Connection to jobs queue ${this.queue.name} is closed`,
      );
    } catch (err) {
      this.loggingService.error(
        `Failed to close connection to jobs queue ${this.queue.name}: ${asError(err).message}`,
      );
    }
  }
}
