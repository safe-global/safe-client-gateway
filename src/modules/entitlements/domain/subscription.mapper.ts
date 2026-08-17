// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type Subscription,
  SubscriptionStatusSchema,
} from '@/datasources/billing-api/entities/subscription.entity';
import { fromSecondsTimestamp } from '@/domain/common/utils/time';
import type { WebhookEvent } from '@/modules/billing/domain/entities/webhook-event.entity';
import type {
  FeatureKey,
  FeatureType,
} from '@/modules/entitlements/domain/entities/feature.entity';
import type { MaterializedSubscription } from '@/modules/entitlements/domain/entities/materialized-subscription.entity';
import {
  isActiveSubscriptionStatus,
  PLAN_NAME_METADATA_KEY,
} from '@/modules/entitlements/domain/entitlements.constants';
import {
  hasFeaturePackageMetadata,
  mapFeaturePackage,
} from '@/modules/entitlements/domain/feature-package.mapper';

type MapperArgs = {
  featureTypeByKey: Map<FeatureKey, FeatureType>;
  onWarning: (message: string) => void;
};

/**
 * Maps a webhook event's own subscription snapshot to its materialized shape,
 * or `null` when the payload is not a complete snapshot — the caller then
 * re-fetches the authoritative state instead. A period end is optional:
 * upstream leaves it unset for a subscription that has no end.
 *
 * An active subscription whose metadata carries no `FEATURE_*` entry counts as
 * incomplete: mapping it would replace the stored package with an empty one,
 * so the authoritative state decides whether the package is really gone.
 */
export function mapEventToSubscription(
  args: MapperArgs & { event: WebhookEvent },
): MaterializedSubscription | null {
  const data = args.event.data;
  const upstreamSubscriptionId = data?.subscriptionId;
  const planId = data?.planId;
  if (!(upstreamSubscriptionId && planId) || data.currentPeriodStart == null) {
    return null;
  }

  const parsedStatus = SubscriptionStatusSchema.safeParse(data.status);
  if (!parsedStatus.success) {
    args.onWarning(
      `Billing webhook event ${args.event.id} carries an unprocessable subscription status: ${data.status}`,
    );
    return null;
  }
  const status = parsedStatus.data;

  if (
    isActiveSubscriptionStatus(status) &&
    !hasFeaturePackageMetadata(data.metadata)
  ) {
    return null;
  }

  const currentPeriodStart = fromSecondsTimestamp(data.currentPeriodStart);
  const currentPeriodEnd = fromSecondsTimestamp(data.currentPeriodEnd);
  if (
    currentPeriodStart === null ||
    (data.currentPeriodEnd != null && currentPeriodEnd === null)
  ) {
    args.onWarning(
      `Billing webhook event ${args.event.id} carries an unrepresentable billing period: ${data.currentPeriodStart}–${data.currentPeriodEnd}`,
    );
    return null;
  }

  return {
    upstreamSubscriptionId,
    status,
    planId,
    planName: data.metadata?.[PLAN_NAME_METADATA_KEY] ?? null,
    currentPeriodStart,
    currentPeriodEnd,
    entitlements: isActiveSubscriptionStatus(status)
      ? mapFeaturePackage({
          metadata: data.metadata,
          featureTypeByKey: args.featureTypeByKey,
          onWarning: (message) =>
            args.onWarning(
              `Feature package of subscription ${upstreamSubscriptionId}: ${message}`,
            ),
        })
      : null,
  };
}

/**
 * Maps upstream subscriptions to their materialized shape, attaching the
 * feature package to the single subscription holding the active slot (newest
 * active-ish one). Upstream anomalies with several active subscriptions are
 * self-healed: the surplus ones are demoted to `canceled` here rather than
 * dropped, so `materialize` writes them and the "one active subscription per
 * space" constraint never sees two rows claiming the slot on the next sync.
 */
export function mapUpstreamSubscriptions(
  args: MapperArgs & { subscriptions: Array<Subscription> },
): Array<MaterializedSubscription> {
  const activeSubscriptions = args.subscriptions
    .filter((subscription) => isActiveSubscriptionStatus(subscription.status))
    .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
  const [active, ...surplusActive] = activeSubscriptions;
  const surplusActiveIds = new Set(
    surplusActive.map((subscription) => subscription.id),
  );

  if (surplusActive.length > 0 && active !== undefined) {
    args.onWarning(
      `Customer ${active.upstreamCustomerId} has ${activeSubscriptions.length} active subscriptions upstream; keeping ${active.id} active and demoting the rest to canceled`,
    );
  }

  return args.subscriptions.map((subscription) => {
    const currentPeriodStart = fromSecondsTimestamp(
      subscription.currentPeriodStart,
    );
    const currentPeriodEnd = fromSecondsTimestamp(
      subscription.currentPeriodEnd,
    );
    // Nothing left to fall back to here — this is already the authoritative
    // state — so an unrepresentable period is stored unset, but not silently.
    if (
      (subscription.currentPeriodStart != null &&
        currentPeriodStart === null) ||
      (subscription.currentPeriodEnd != null && currentPeriodEnd === null)
    ) {
      args.onWarning(
        `Subscription ${subscription.id} carries an unrepresentable billing period: ${subscription.currentPeriodStart}–${subscription.currentPeriodEnd}`,
      );
    }

    return {
      upstreamSubscriptionId: subscription.id,
      status: surplusActiveIds.has(subscription.id)
        ? 'canceled'
        : subscription.status,
      planId: subscription.plan.id,
      planName: subscription.plan.name ?? null,
      currentPeriodStart,
      currentPeriodEnd,
      entitlements:
        active !== undefined && subscription.id === active.id
          ? mapFeaturePackage({
              metadata: subscription.metadata,
              featureTypeByKey: args.featureTypeByKey,
              onWarning: (message) =>
                args.onWarning(
                  `Feature package of subscription ${subscription.id}: ${message}`,
                ),
            })
          : null,
    };
  });
}
