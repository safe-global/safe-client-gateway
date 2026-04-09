// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { EventCacheHelper } from '@/modules/hooks/domain/helpers/event-cache.helper';
import type { IHooksRepository } from '@/modules/hooks/domain/hooks.repository.interface';
import type { Event } from '@/modules/hooks/routes/entities/event.entity';
import { ConfigEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { EventSchema } from '@/modules/hooks/routes/entities/schemas/event.schema';
import { IPushNotificationService } from '@/modules/notifications/domain/push/push-notification.service.interface';
import { IQueuesRepository } from '@/modules/queues/domain/queues-repository.interface';

/**
 * Consumes AMQP events from the shared RabbitMQ exchange. Events may
 * originate from either the Transaction Service or the Queue Service
 * (both publish to the same exchange with identical payload shapes).
 *
 * All event handlers are idempotent: receiving the same logical event
 * twice (e.g. from both services) results in redundant cache
 * invalidations that are safe to replay.
 */
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
    }
    return this.eventCacheHelper.onUnsupportedChainEvent(event);
  }
}
