// SPDX-License-Identifier: FSL-1.1-MIT
import type { PaymentLink } from '@/datasources/billing-api/entities/payment-link.entity';
import {
  GRACE_PERIOD_METADATA_KEY,
  PLAN_NAME_METADATA_KEY,
} from '@/modules/entitlements/domain/entitlements.constants';

/** What the offer filter needs to know about the workspace. */
export type SpaceOfferEligibility = {
  createdBeforeEnforcement: boolean;
  hasEverSubscribed: boolean;
  activePlanName: string | null;
};

/**
 * Which trial offer a link belongs to, read from its `gracePeriod` metadata:
 * `true` for the legacy grace offered to pre-enforcement workspaces, `false`
 * for the standard trial. `null` when the link carries no (or an
 * unrecognized) value, which offers it to neither.
 */
export function gracePeriodOf(link: PaymentLink): boolean | null {
  const value = link.metadata[GRACE_PERIOD_METADATA_KEY];
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return null;
}

export function planNameOf(link: PaymentLink): string | null {
  return link.metadata[PLAN_NAME_METADATA_KEY] ?? null;
}

/** Whether the link offers a free period; a paid link bills immediately. */
function isTrialLink(link: PaymentLink): boolean {
  return link.trialPeriodDays != null;
}

/** A trial link no workspace is offered, because its tag is missing or unknown. */
export function isUnclassifiedTrialLink(link: PaymentLink): boolean {
  return isTrialLink(link) && gracePeriodOf(link) === null;
}

/** Whether the workspace is offered this link. */
export function isOfferedToSpace(
  link: PaymentLink,
  args: SpaceOfferEligibility,
): boolean {
  const isTrial = isTrialLink(link);

  switch (true) {
    // Already subscribed once: trials are off the table.
    case isTrial && args.hasEverSubscribed:
      return false;
    // Never subscribed: offer only the trial matching this enforcement side.
    case isTrial:
      return gracePeriodOf(link) === args.createdBeforeEnforcement;
    // Never subscribed: no paid link until a plan is picked first.
    case !args.hasEverSubscribed:
      return false;
    // Subscribed: every paid plan is offered except the current one.
    default:
      return (
        args.activePlanName === null || planNameOf(link) !== args.activePlanName
      );
  }
}
