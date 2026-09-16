// SPDX-License-Identifier: FSL-1.1-MIT
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';
import type { StockMeteredFeature } from '@/modules/entitlements/domain/entitlements.constants';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';

export const IEntitlementEnforcement = Symbol('IEntitlementEnforcement');

/** Reached through this token so a gated module never imports the service. */
export interface IEntitlementEnforcement {
  /**
   * Admits an action consuming `delta`, or rejects it with
   * {@link QuotaExceededError}. `delta: 0` asks only whether the workspace is
   * already at its limit — what a guard can decide before the payload is
   * validated.
   */
  assertWithinQuota(args: {
    spaceId: Space['id'];
    featureKey: FeatureKey;
    delta: number;
  }): Promise<void>;

  /**
   * The same verdict split in two, for a caller that must count inside its own
   * transaction: the plan is resolved here, and the returned check only
   * compares numbers, so nothing does I/O under that caller's lock.
   */
  prepareQuotaCheck(args: {
    spaceId: Space['id'];
    featureKey: FeatureKey;
    delta: number;
  }): Promise<(used: number) => void>;

  /**
   * Spends `delta` of the workspace's allowance, or rejects it with
   * {@link QuotaExceededError} having spent nothing. Reserving and admitting
   * share one transaction, so two callers cannot pass the same count and
   * overshoot the allowance together.
   *
   * The spend is committed before the action it pays for happens, so a caller
   * that learns the action never happened gives it back with
   * {@link refundQuota}. A stock-metered feature is excluded by the type: its
   * usage is a live count its own module owns, with nothing to reserve.
   */
  consumeQuota(args: {
    spaceId: Space['id'];
    featureKey: Exclude<FeatureKey, StockMeteredFeature>;
    delta: number;
  }): Promise<void>;

  /** Gives back what {@link consumeQuota} reserved for something that never happened. */
  refundQuota(args: {
    spaceId: Space['id'];
    featureKey: Exclude<FeatureKey, StockMeteredFeature>;
    delta: number;
  }): Promise<void>;
}
