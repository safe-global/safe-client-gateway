// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { MaterializedSubscription } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import {
  isActiveSubscriptionStatus,
  ordersAfter,
} from '@/modules/entitlements/domain/entitlements.constants';
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
   * Materializes the state an event carries in its own payload, and stamps the
   * space with that event's `created`. Applied only while it orders strictly
   * after the mark already stored — decided here, inside the transaction that
   * holds the space's lock, so the answer cannot go stale between the check and
   * the write. `false` means nothing was written and the caller should ask
   * upstream instead.
   */
  public async materializeFromEvent(args: {
    spaceId: Space['id'];
    subscription: MaterializedSubscription;
    eventAt: Date;
  }): Promise<boolean> {
    return await this.materializeUnderLock({
      spaceId: args.spaceId,
      subscriptions: [args.subscription],
      admit: (storedEventAt) => {
        if (!ordersAfter(args.eventAt, storedEventAt)) {
          this.loggingService.debug(
            `Space ${args.spaceId} kept its state: an event stamped ${args.eventAt.toISOString()} does not order after the materialized ${this.markLabel(storedEventAt)}`,
          );
          return null;
        }
        return { lastEventAt: args.eventAt };
      },
    });
  }

  /**
   * Materializes state read from the billing service, which is current as of
   * when the fetch went out rather than as of any event. `observedEventAt` is
   * the mark read just before that fetch: if it has moved by the time the lock
   * is held, a concurrent delivery has written something this snapshot may
   * predate, so nothing is written and `false` says to look again. The stamp
   * only ever rises — the later of what is stored and the triggering event.
   */
  public async materializeAuthoritative(args: {
    spaceId: Space['id'];
    subscriptions: Array<MaterializedSubscription>;
    observedEventAt: Date | null;
    triggerEventAt: Date | null;
  }): Promise<boolean> {
    return await this.materializeUnderLock({
      spaceId: args.spaceId,
      subscriptions: args.subscriptions,
      admit: (storedEventAt) => {
        if (storedEventAt?.getTime() !== args.observedEventAt?.getTime()) {
          this.loggingService.warn(
            `Space ${args.spaceId} moved from ${this.markLabel(args.observedEventAt)} to ${this.markLabel(storedEventAt)} while its authoritative state was being read; nothing written`,
          );
          return null;
        }
        return {
          lastEventAt: this.laterOf(storedEventAt, args.triggerEventAt),
        };
      },
    });
  }

  /**
   * Idempotently materializes the upstream subscription state of a workspace:
   * upserts every subscription row by `upstreamSubscriptionId` and replaces
   * the active subscription's entitlement package wholesale, in one
   * transaction.
   *
   * `admit` is the caller's ordering rule, applied to the mark this method
   * holds under the space's lock: it returns the stamp to write, or `null` to
   * abandon the write and log why.
   */
  private async materializeUnderLock(args: {
    spaceId: Space['id'];
    subscriptions: Array<MaterializedSubscription>;
    admit: (storedEventAt: Date | null) => { lastEventAt: Date | null } | null;
  }): Promise<boolean> {
    // Existence check: throws when the space is gone.
    await this.spacesRepository.findUuidById(args.spaceId);

    const withPackage = args.subscriptions.filter(
      (subscription) => subscription.entitlements !== null,
    );
    if (withPackage.length > 1) {
      throw new Error(
        `Materializing space ${args.spaceId} got ${withPackage.length} subscriptions carrying an entitlement package; expected at most 1`,
      );
    }

    const activeIsh = args.subscriptions.filter((subscription) =>
      isActiveSubscriptionStatus(subscription.status),
    );
    if (activeIsh.length > 1) {
      throw new Error(
        `Materializing space ${args.spaceId} got ${activeIsh.length} active-ish subscriptions; expected at most 1`,
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

    return await this.postgresDatabaseService.transaction(
      async (entityManager) => {
        // Serializes concurrent webhooks for this space, so the mark read below
        // is what the write is actually ordered against.
        await this.subscriptionsRepository.lockSpaceForSync(
          args.spaceId,
          entityManager,
        );
        const storedEventAt = await this.subscriptionsRepository.getLastEventAt(
          args.spaceId,
          entityManager,
        );
        const admitted = args.admit(storedEventAt);
        if (admitted === null) {
          return false;
        }
        const { lastEventAt } = admitted;

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
              exceptUpstreamSubscriptionId:
                incomingActive.upstreamSubscriptionId,
              lastEventAt,
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
                  lastEventAt,
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
                    `Space ${args.spaceId} dropped unknown feature key '${entitlement.featureKey}' on subscription ${packaged.upstreamSubscriptionId}`,
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

        return true;
      },
    );
  }

  private markLabel(mark: Date | null): string {
    return mark?.toISOString() ?? 'unset';
  }

  private laterOf(
    storedEventAt: Date | null,
    triggerEventAt: Date | null,
  ): Date | null {
    if (storedEventAt === null) return triggerEventAt;
    if (triggerEventAt === null) return storedEventAt;
    return storedEventAt > triggerEventAt ? storedEventAt : triggerEventAt;
  }
}
