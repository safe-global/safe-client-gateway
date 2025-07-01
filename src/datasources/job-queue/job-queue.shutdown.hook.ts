import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { JOBS_QUEUE_NAME } from '@/domain/common/entities/jobs.constants';
import { asError } from '@/logging/utils';

@Injectable()
export class JobQueueShutdownHook implements OnModuleDestroy {
  constructor(
    @InjectQueue(JOBS_QUEUE_NAME) private readonly queue: Queue,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  public async onModuleDestroy(): Promise<void> {
    this.loggingService.info('Closing connection to jobs queue');
    try {
      await this.queue.close();
      this.loggingService.info('Connection to jobs queue closed');
    } catch (err) {
      this.loggingService.error(
        `Failed to close connection to jobs queue: ${asError(err).message}`,
      );
    }
  }
}
