// SPDX-License-Identifier: FSL-1.1-MIT
import type { PaymentLink } from '#/datasources/billing-api/entities/payment-link.entity';
import { GRACE_PERIOD_METADATA_KEY } from '#/modules/entitlements/domain/entitlements.constants';

/** What the offer filter needs to know about the workspace. */
export type SpaceOfferEligibility = {
  /** Created before enforcement, while the grace claim window is still open. */
  isOfferedGracePeriod: boolean;
  hasEverSubscribed: boolean;
  activePlanId: string | null;
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

/** Whether the link offers a free period; a paid link bills immediately. */
function isTrialLink(link: PaymentLink): boolean {
  return link.trialPeriodDays != null;
}

/** A trial link no workspace is offered, because its tag is missing or unknown. */
export function isUnclassifiedTrialLink(link: PaymentLink): boolean {
  return isTrialLink(link) && gracePeriodOf(link) === null;
}

/** Whether this link offers `planId` — a price id, held in its line items. */
export function offersPlan(link: PaymentLink, planId: string): boolean {
  return link.lineItems?.some((item) => item.price.id === planId) ?? false;
}

/** Whether pre-enforcement workspaces can still claim the legacy grace. */
export function isGracePeriodClaimOpen(args: {
  now: Date;
  endsAt: Date;
}): boolean {
  return args.now < args.endsAt;
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
    // Never subscribed: the legacy grace while claimable, else the standard trial.
    case isTrial:
      return gracePeriodOf(link) === args.isOfferedGracePeriod;
    // Never subscribed: no paid link until a plan is picked first.
    case !args.hasEverSubscribed:
      return false;
    // Subscribed: every paid plan is offered except the current one.
    default:
      return args.activePlanId === null || !offersPlan(link, args.activePlanId);
  }
}
