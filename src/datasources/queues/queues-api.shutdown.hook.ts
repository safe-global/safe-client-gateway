import { QueueConsumer } from '@/datasources/queues/queues-api.module';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class QueuesApiShutdownHook implements OnModuleDestroy {
  constructor(
    @Inject('QueueConsumer') private readonly queueConsumer: QueueConsumer,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.loggingService.info('Closing connection to queues');
    try {
      await this.queueConsumer.channel.close();
      this.loggingService.info('Connection to queues closed');
    } catch (err) {
      this.loggingService.error(
        `Failed to close connection to queues: ${asError(err)}`,
      );
    }
  }
}
