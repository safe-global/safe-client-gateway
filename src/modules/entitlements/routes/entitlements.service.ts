// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { MaterializedSubscription } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import { isActiveSubscriptionStatus } from '@/modules/entitlements/domain/entitlements.constants';
import { IFeaturesRepository } from '@/modules/entitlements/domain/features.repository.interface';
import { ISubscriptionEntitlementsRepository } from '@/modules/entitlements/domain/subscription-entitlements.repository.interface';
import { ISubscriptionsRepository } from '@/modules/entitlements/domain/subscriptions.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';

/**
 * Orchestrates the entitlements feature: reads and writes rows through the
 * per-table repositories, and owns the transactions spanning several tables.
 */
@Injectable()
export class EntitlementsService {
  public constructor(
    @Inject(IFeaturesRepository)
    private readonly featuresRepository: IFeaturesRepository,
    @Inject(ISubscriptionsRepository)
    private readonly subscriptionsRepository: ISubscriptionsRepository,
    @Inject(ISubscriptionEntitlementsRepository)
    private readonly subscriptionEntitlementsRepository: ISubscriptionEntitlementsRepository,
    @Inject(ISpacesRepository)
    private readonly spacesRepository: ISpacesRepository,
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Idempotently materializes the upstream subscription state of a workspace:
   * upserts every subscription row by `upstreamSubscriptionId` and replaces
   * the active subscription's entitlement package wholesale, in one
   * transaction.
   */
  public async materialize(args: {
    spaceId: Space['id'];
    subscriptions: Array<MaterializedSubscription>;
  }): Promise<void> {
    // Existence check: throws when the space is gone.
    await this.spacesRepository.findUuidById(args.spaceId);

    const withPackage = args.subscriptions.filter(
      (subscription) => subscription.entitlements !== null,
    );
    if (withPackage.length > 1) {
      throw new Error(
        `materialize() received ${withPackage.length} subscriptions carrying an entitlement package for space ${args.spaceId}; expected at most 1`,
      );
    }

    const activeIsh = args.subscriptions.filter((subscription) =>
      isActiveSubscriptionStatus(subscription.status),
    );
    if (activeIsh.length > 1) {
      throw new Error(
        `materialize() received ${activeIsh.length} active-ish subscriptions for space ${args.spaceId}; expected at most 1`,
      );
    }

    // Only the subscription holding the active slot carries a package, and
    // there is at most one (asserted above) — so the catalog is needed only
    // when that subscription is present.
    const packaged = withPackage.at(0);
    const featureIdByKey =
      packaged === undefined
        ? new Map<string, number>()
        : new Map(
            (await this.featuresRepository.getFeatures()).map((feature) => [
              feature.key,
              feature.id,
            ]),
          );

    const incomingActive = activeIsh.at(0);

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      let activeSubscriptionId: number | null = null;

      // Frees the "one active subscription per space" slot before the upserts
      // below claim it: on a plan change the outgoing subscription is still
      // active here, and its own event may not have arrived yet. Running it
      // first is also what lets the upserts below go in any order — no other
      // row can hold the slot by the time they run.
      if (incomingActive !== undefined) {
        await this.subscriptionsRepository.demoteActiveSubscriptions(
          {
            spaceId: args.spaceId,
            exceptUpstreamSubscriptionId: incomingActive.upstreamSubscriptionId,
          },
          entityManager,
        );
      }

      for (const subscription of args.subscriptions) {
        const subscriptionId =
          await this.subscriptionsRepository.upsertSubscription(
            {
              spaceId: args.spaceId,
              upstreamSubscriptionId: subscription.upstreamSubscriptionId,
              values: {
                status: subscription.status,
                planId: subscription.planId,
                planName: subscription.planName,
                currentPeriodStart: subscription.currentPeriodStart,
                currentPeriodEnd: subscription.currentPeriodEnd,
              },
            },
            entityManager,
          );

        if (subscription.entitlements !== null) {
          activeSubscriptionId = subscriptionId;
        }
      }

      if (activeSubscriptionId !== null && packaged?.entitlements != null) {
        // Full replace: reprocessing the same upstream state yields the same
        // rows (idempotent by construction).
        await this.subscriptionEntitlementsRepository.deleteEntitlementsBySubscriptionId(
          activeSubscriptionId,
          entityManager,
        );
        await this.subscriptionEntitlementsRepository.createEntitlements(
          {
            subscriptionId: activeSubscriptionId,
            entitlements: packaged.entitlements.flatMap((entitlement) => {
              const featureId = featureIdByKey.get(entitlement.featureKey);
              if (featureId === undefined) {
                // The parser already drops unknown keys against its own
                // catalog snapshot; reaching this means the feature was
                // renamed/deleted in the narrow window before this
                // independent re-fetch. Rare, but silently dropping a
                // purchased entitlement is worth a trace.
                this.loggingService.warn(
                  `materialize() dropped unknown feature key '${entitlement.featureKey}' for space ${args.spaceId}, subscription ${packaged.upstreamSubscriptionId}`,
                );
                return [];
              }
              return [
                {
                  featureId,
                  enabled: entitlement.enabled,
                  quota: entitlement.quota,
                  value: entitlement.value,
                },
              ];
            }),
          },
          entityManager,
        );
      }
    });
  }
}
