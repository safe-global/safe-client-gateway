import { IConfigurationService } from '@/config/configuration.service.interface';
import { IQueuesApiService } from '@/datasources/queues/queues-api.service.interface';
import { IQueuesRepository } from '@/domain/queues/queues-repository.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { WebHookSchema } from '@/routes/cache-hooks/entities/schemas/web-hook.schema';
import { Event } from '@/routes/cache-hooks/entities/event.entity';
import { Inject, Injectable, Scope } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';

// Only allow one instance across the app to prevent multiple queue subscriptions
@Injectable({ scope: Scope.DEFAULT })
export class QueuesRepository implements IQueuesRepository {
  private readonly queueName: string;
  private readonly listeners: Array<(event: Event) => Promise<unknown>> = [];

  constructor(
    @Inject(IQueuesApiService) private readonly queuesApi: IQueuesApiService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.queueName = this.configurationService.getOrThrow<string>('amqp.queue');
  }

  onModuleInit(): Promise<void> {
    return this.queuesApi.subscribe(
      this.queueName,
      async (msg: ConsumeMessage): Promise<void> => {
        try {
          const content = JSON.parse(msg.content.toString());
          const event = WebHookSchema.parse(content);
          await Promise.allSettled(
            this.listeners.map((listener) => listener(event)),
          );
        } catch (err) {
          this.loggingService.error(err);
        }
      },
    );
  }

  onEvent(listener: (event: Event) => Promise<unknown>): void {
    this.listeners.push(listener);
  }
}
