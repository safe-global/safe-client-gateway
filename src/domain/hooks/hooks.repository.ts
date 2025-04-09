import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { Event } from '@/routes/hooks/entities/event.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IQueuesRepository } from '@/domain/queues/queues-repository.interface';
import { ConsumeMessage } from 'amqplib';
import { EventSchema } from '@/routes/hooks/entities/schemas/event.schema';
import { IHooksRepository } from '@/domain/hooks/hooks.repository.interface';
import { EventNotificationsHelper } from '@/domain/hooks/helpers/event-notifications.helper';
import { EventCacheHelper } from '@/domain/hooks/helpers/event-cache.helper';
import { ConfigEventType } from '@/routes/hooks/entities/event-type.entity';

@Injectable()
export class HooksRepository implements IHooksRepository, OnModuleInit {
  private readonly queueName: string;

  constructor(
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(IQueuesRepository)
    private readonly queuesRepository: IQueuesRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(EventNotificationsHelper)
    private readonly eventNotificationsHelper: EventNotificationsHelper,
    @Inject(EventCacheHelper)
    private readonly eventCacheHelper: EventCacheHelper,
  ) {
    this.queueName = this.configurationService.getOrThrow<string>('amqp.queue');
  }

  onModuleInit(): Promise<void> {
    return this.queuesRepository.subscribe(
      this.queueName,
      async (msg: ConsumeMessage) => {
        try {
          const content = JSON.parse(msg.content.toString());
          const event: Event = EventSchema.parse(content);
          await this.onEvent(event);
        } catch (err) {
          this.loggingService.error(err);
        }
      },
    );
  }

  async onEvent(event: Event): Promise<unknown> {
    const isSupportedChainId = await this.eventCacheHelper.isSupportedChainMemo(
      event.chainId,
    );
    if (isSupportedChainId || event.type === ConfigEventType.CHAIN_UPDATE) {
      return Promise.allSettled([
        this.eventCacheHelper.onEventClearCache(event),
        this.eventNotificationsHelper.onEventEnqueueNotifications(event),
      ]).finally(() => {
        this.eventCacheHelper.onEventLog(event);
      });
    } else {
      return this.eventCacheHelper.onUnsupportedChainEvent(event);
    }
  }
}
