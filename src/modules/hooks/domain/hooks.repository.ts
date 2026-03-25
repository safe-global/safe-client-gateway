// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { type Event } from '@/modules/hooks/routes/entities/event.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IQueuesRepository } from '@/modules/queues/domain/queues-repository.interface';
import { type ConsumeMessage } from 'amqplib';
import { EventSchema } from '@/modules/hooks/routes/entities/schemas/event.schema';
import { IHooksRepository } from '@/modules/hooks/domain/hooks.repository.interface';
import { EventCacheHelper } from '@/modules/hooks/domain/helpers/event-cache.helper';
import { ConfigEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { IPushNotificationService } from '@/modules/notifications/domain/push/push-notification.service.interface';

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
    @Inject(IPushNotificationService)
    private readonly pushNotificationService: IPushNotificationService,
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
        this.pushNotificationService.enqueueEvent(event),
      ]).finally(() => {
        this.eventCacheHelper.onEventLog(event);
      });
    } else {
      return this.eventCacheHelper.onUnsupportedChainEvent(event);
    }
  }
}
