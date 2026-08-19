// SPDX-License-Identifier: FSL-1.1-MIT
import type {
  FeatureKey,
  FeatureType,
} from '@/modules/entitlements/domain/entities/feature.entity';

/**
 * The computed entitlement state of a workspace, produced by
 * `IEntitlementsRepository.resolveEntitlements`. Both branches (active
 * subscription / Free-tier catalog defaults) produce this exact shape, so
 * consumers never know which one served them.
 */
export type ResolvedPlan = {
  id: string;
  name: string | null;
  cycleEndsAt: Date | null;
};

export type ResolvedEntitlement = {
  feature: FeatureKey;
  type: FeatureType;
  enabled: boolean;
  /** Metered only. NULL = unlimited. Always the plan's quota, never inflated. */
  quota?: number | null;
  /** Metered only. `used > quota` is a legal state. */
  used?: number;
  /** Metered only. TRUE once `used` passed `quota`; never for an unlimited one. */
  overLimit?: boolean;
  /** Metered only. NULL for stock-type features (no reset window). */
  resetsAt?: Date | null;
  /** Value-typed only. */
  value?: string | null;
};

export type ResolvedEntitlements = {
  /** NULL when the workspace is on the Free plan. */
  plan: ResolvedPlan | null;
  entitlements: Array<ResolvedEntitlement>;
};
