import { QueueConsumer } from '@/datasources/queues/queue-consumer.module';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class QueueConsumerShutdownHook implements OnModuleDestroy {
  constructor(
    @Inject('QueueConsumer') private readonly queueConsumer: QueueConsumer,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.loggingService.info('Closing connection to queue');
    await this.queueConsumer.channel.close();
    this.loggingService.info('Queue connection closed');
  }
}
