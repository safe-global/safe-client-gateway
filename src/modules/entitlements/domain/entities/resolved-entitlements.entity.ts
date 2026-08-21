// SPDX-License-Identifier: FSL-1.1-MIT
import type { FeatureType } from '@/modules/entitlements/domain/entities/feature.entity';

/**
 * The computed entitlement state of a workspace, produced by
 * `EntitlementsService.resolveEntitlements`. Both branches (active
 * subscription / catalog defaults) produce this exact shape, so consumers
 * never know which one served them.
 */
export type ResolvedPlan = {
  id: string;
  name: string | null;
  cycleEndsAt: Date | null;
};

type ResolvedEntitlementBase = {
  /** Any catalog key; the response publishes only `FEATURE_KEYS`. */
  feature: string;
  /** Whether the plan grants the feature at all. */
  enabled: boolean;
};

/** A feature that is only ever on or off. */
export type ResolvedBinaryEntitlement = ResolvedEntitlementBase & {
  type: FeatureType.Binary;
};

/** A feature whose grant is a value, e.g. a fee tier. */
export type ResolvedValueEntitlement = ResolvedEntitlementBase & {
  type: FeatureType.Value;
  value: string | null;
};

/**
 * A feature with a quota and usage measured against it. The three fields below
 * are always present together — that is what discriminating on `type` buys
 * over one flat shape of optionals, where a NULL `quota` could not tell
 * "unlimited" apart from "does not apply".
 */
export type ResolvedMeteredEntitlement = ResolvedEntitlementBase & {
  type: FeatureType.Metered;
  /** NULL = unlimited. Always the plan's quota, never inflated. */
  quota: number | null;
  /** `used > quota` is a legal state. */
  used: number;
  /** NULL for stock-type features, which have no reset window. */
  resetsAt: Date | null;
};

export type ResolvedEntitlement =
  | ResolvedBinaryEntitlement
  | ResolvedValueEntitlement
  | ResolvedMeteredEntitlement;

export type ResolvedEntitlements = {
  /** NULL when the workspace has no active subscription. */
  plan: ResolvedPlan | null;
  entitlements: Array<ResolvedEntitlement>;
};
