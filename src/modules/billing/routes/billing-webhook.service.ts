// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable } from '@nestjs/common';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { IBillingApi } from '@/domain/interfaces/billing-api.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { mapBillingSubscriptionStatus } from '@/modules/billing/domain/billing-subscription-status.mapper';
import type { BillingWebhookEvent } from '@/modules/billing/domain/entities/billing-webhook-event.entity';
import {
  BillingWebhookSubscriptionDataSchema,
  isRelevantSubscriptionEvent,
} from '@/modules/billing/domain/entities/billing-webhook-event.entity';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { ISubscriptionsRepository } from '@/modules/subscriptions/domain/subscriptions.repository.interface';

@Injectable()
export class BillingWebhookService {
  public constructor(
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
    @Inject(IBillingApi)
    private readonly billingApi: IBillingApi,
    @Inject(ISubscriptionsRepository)
    private readonly subscriptionsRepository: ISubscriptionsRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
  ) {}

  public async handle(event: BillingWebhookEvent): Promise<void> {
    // Every guard below acks (returns, no retry): a subsequent event for the
    // same subscription (e.g. the next update) will re-run this same lookup.
    if (!isRelevantSubscriptionEvent(event.type)) {
      this.loggingService.warn(
        `Ignoring billing webhook event ${event.id} of type ${event.type}: not relevant for subscription handling.`,
      );
      return;
    }

    const data = BillingWebhookSubscriptionDataSchema.safeParse(event.data);
    if (!data.success) {
      this.loggingService.error(
        `Billing webhook event ${event.id} of type ${event.type} has an unexpected payload shape`,
      );
      return;
    }

    const upstreamCustomerId = data.data.customer.upstreamCustomerId;
    if (!upstreamCustomerId) {
      this.loggingService.error(
        `Billing webhook event ${event.id} is missing upstreamCustomerId`,
      );
      return;
    }

    const subscriptionId = data.data.subscriptionId;
    if (!subscriptionId) {
      this.loggingService.warn(
        `Billing webhook event ${event.id} is missing subscriptionId`,
      );
      return;
    }

    const space = await this.spacesRepository.findOne({
      where: { uuid: upstreamCustomerId },
      select: { id: true },
    });
    if (!space) {
      this.loggingService.error(
        `Billing webhook event ${event.id} references an unknown Space (upstreamCustomerId=${upstreamCustomerId})`,
      );
      return;
    }
    const spaceId = space.id;

    await this.cacheService.deleteByKey(
      CacheRouter.getBillingSubscriptionsCacheDir({
        upstreamCustomerId,
        status: 'all',
      }).key,
    );

    const subscriptions = await this.billingApi.getSubscriptionsByCustomerId({
      upstreamCustomerId,
      status: 'all',
    });
    const subscription = subscriptions.find(
      (candidate) => candidate.id === subscriptionId,
    );
    if (!subscription) {
      this.loggingService.warn(
        `Billing webhook event ${event.id} references an unknown subscription ${subscriptionId}`,
      );
      return;
    }

    await this.subscriptionsRepository.upsertFromEvent({
      id: subscription.id,
      spaceId,
      status: mapBillingSubscriptionStatus(subscription.status),
      metadata: data.data.metadata ?? {},
      lastEventId: event.id,
      lastEventOccurredAt: new Date(event.created * 1000),
    });
  }
}
