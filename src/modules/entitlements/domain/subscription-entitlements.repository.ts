// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
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
    const repository = await this.getRepository(entityManager);
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
    const repository = await this.getRepository(entityManager);
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

  /** Bound to the caller's transaction when one is passed. */
  private async getRepository(
    entityManager?: EntityManager,
  ): Promise<Repository<SubscriptionEntitlement>> {
    return entityManager
      ? entityManager.getRepository(SubscriptionEntitlement)
      : await this.postgresDatabaseService.getRepository(
          SubscriptionEntitlement,
        );
  }
}
