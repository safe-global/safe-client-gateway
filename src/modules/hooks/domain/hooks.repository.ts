// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { IConfigurationService } from '#/config/configuration.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import { ICounterfactualSafesRepository } from '#/modules/counterfactual-safes/domain/counterfactual-safes.repository.interface';
import { EventCacheHelper } from '#/modules/hooks/domain/helpers/event-cache.helper';
import type { IHooksRepository } from '#/modules/hooks/domain/hooks.repository.interface';
import type { Event } from '#/modules/hooks/routes/entities/event.entity';
import {
  ConfigEventType,
  TransactionEventType,
} from '#/modules/hooks/routes/entities/event-type.entity';
import { EventSchema } from '#/modules/hooks/routes/entities/schemas/event.schema';
import { IPushNotificationService } from '#/modules/notifications/domain/push/push-notification.service.interface';
import { IQueuesRepository } from '#/modules/queues/domain/queues-repository.interface';

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
    @Inject(ICounterfactualSafesRepository)
    private readonly counterfactualSafesRepository: ICounterfactualSafesRepository,
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
        this.markCounterfactualSafeAsDeployed(event),
      ]).finally(() => {
        this.eventCacheHelper.onEventLog(event);
      });
    }
    return this.eventCacheHelper.onUnsupportedChainEvent(event);
  }

  private async markCounterfactualSafeAsDeployed(event: Event): Promise<void> {
    if (event.type !== TransactionEventType.SAFE_CREATED) {
      return;
    }
    const { chainId, address } = event;
    try {
      const isMarked = await this.counterfactualSafesRepository.markAsDeployed({
        chainId,
        address,
      });
      if (isMarked) {
        this.loggingService.info({
          message: 'Marked counterfactual Safe as deployed',
          chainId,
          address,
        });
      }
    } catch (error) {
      this.loggingService.error({
        message: 'Failed to mark counterfactual Safe as deployed',
        chainId,
        address,
        error: asError(error).message,
      });
    }
  }
}
