// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { SubscriptionEntitlement } from '@/modules/entitlements/datasources/entities/subscription-entitlement.entity.db';
import type {
  ISubscriptionEntitlementsRepository,
  SubscriptionEntitlementValues,
} from '@/modules/entitlements/domain/subscription-entitlements.repository.interface';

@Injectable()
export class SubscriptionEntitlementsRepository
  implements ISubscriptionEntitlementsRepository
{
  public constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async deleteEntitlementsBySubscriptionId(
    subscriptionId: number,
    entityManager?: EntityManager,
  ): Promise<void> {
    const repository = entityManager
      ? entityManager.getRepository(SubscriptionEntitlement)
      : await this.postgresDatabaseService.getRepository(
          SubscriptionEntitlement,
        );
    await repository.delete({
      subscription: { id: subscriptionId },
    });
  }

  public async createEntitlements(
    args: {
      subscriptionId: number;
      entitlements: Array<SubscriptionEntitlementValues>;
    },
    entityManager?: EntityManager,
  ): Promise<void> {
    if (args.entitlements.length === 0) {
      return;
    }
    const repository = entityManager
      ? entityManager.getRepository(SubscriptionEntitlement)
      : await this.postgresDatabaseService.getRepository(
          SubscriptionEntitlement,
        );
    await repository.insert(
      args.entitlements.map((entitlement) => ({
        subscription: { id: args.subscriptionId },
        feature: { id: entitlement.featureId },
        enabled: entitlement.enabled,
        quota: entitlement.quota,
        value: entitlement.value,
      })),
    );
  }
}
