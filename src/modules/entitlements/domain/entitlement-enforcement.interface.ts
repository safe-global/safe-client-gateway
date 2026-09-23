// SPDX-License-Identifier: FSL-1.1-MIT

import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import type {
  BinaryFeature,
  StockMeteredFeature,
} from '@/modules/entitlements/domain/entitlements.constants';
import type { UsageKey } from '@/modules/entitlements/domain/space-feature-usage.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';

export const IEntitlementEnforcement = Symbol('IEntitlementEnforcement');

/**
 * What {@link IEntitlementEnforcement.consumeQuota} wrote: which counter it
 * charged and by how much. Everything
 * {@link IEntitlementEnforcement.refundQuota} needs to reverse exactly that
 * increment, so nothing about the spend is re-derived at refund time.
 */
export type ConsumedQuota = {
  spaceId: Space['id'];
  period: UsageKey;
  delta: number;
};

/** Reached through this token so a gated module never imports the service. */
export interface IEntitlementEnforcement {
  /**
   * Admits an action consuming `delta` of a metered feature's allowance, or
   * rejects it with {@link QuotaExceededError}.
   */
  assertWithinQuota(args: {
    spaceId: Space['id'];
    featureKey: Exclude<FeatureKey, BinaryFeature>;
    delta: number;
  }): Promise<void>;

  /**
   * Admits a Binary feature the plan simply grants or does not, or
   * rejects it with {@link FeatureNotGrantedError}.
   */
  assertFeatureGranted(args: {
    spaceId: Space['id'];
    featureKey: BinaryFeature;
  }): Promise<void>;

  /**
   * The same verdict split in two, for a caller that must count inside its own
   * transaction: the plan is resolved here, and the returned check only
   * compares numbers, so nothing does I/O under that caller's lock. `delta`
   * goes to the check because what an action consumes can itself depend on
   * the state read under that lock.
   */
  prepareQuotaCheck(args: {
    spaceId: Space['id'];
    featureKey: FeatureKey;
  }): Promise<(args: { used: number; delta: number }) => void>;

  /**
   * Spends `delta` of the workspace's allowance, or rejects it with
   * {@link QuotaExceededError} having spent nothing. Reserving and admitting
   * share one transaction, so two callers cannot pass the same count and
   * overshoot the allowance together.
   *
   * The spend is committed before the action it pays for happens, so a caller
   * that learns the action never happened gives it back with
   * {@link refundQuota}, passing back what this returned. A stock-metered
   * feature is excluded by the type: its usage is a live count its own module
   * owns, with nothing to reserve.
   */
  consumeQuota(args: {
    spaceId: Space['id'];
    featureKey: Exclude<FeatureKey, StockMeteredFeature>;
    delta: number;
  }): Promise<ConsumedQuota>;

  /**
   * Gives back a spend whose action never happened, as the spend itself
   * records it. Re-deriving the counter here would credit the wrong one: the
   * period the plan names can move while the action is in flight — a webhook
   * advancing the billing cycle, or a Free window rolling over on its own
   * anchor — leaving the charged period standing and driving the new one
   * negative.
   */
  refundQuota(consumed: ConsumedQuota): Promise<void>;
}
