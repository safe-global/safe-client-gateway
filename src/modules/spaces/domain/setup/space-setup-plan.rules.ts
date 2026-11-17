// SPDX-License-Identifier: FSL-1.1-MIT
import type { PaymentLink } from '#/datasources/billing-api/entities/payment-link.entity';
import { parseSafeSeatQuota } from '#/modules/entitlements/domain/feature-package.mapper';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import type { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import type { SpaceSetupSafe } from '#/modules/spaces/domain/setup/entities/space-setup.entity';
import { BillingUnavailableError } from '#/modules/spaces/domain/setup/errors/billing-unavailable.error';
import { NotEnoughSeatsError } from '#/modules/spaces/domain/setup/errors/not-enough-seats.error';
import { PlanNotOfferedError } from '#/modules/spaces/domain/setup/errors/plan-not-offered.error';
import { PlanRequiredError } from '#/modules/spaces/domain/setup/errors/plan-required.error';

/**
 * Whether the request may start a setup with this plan choice: a plan is
 * bought through billing, so it needs billing; no plan is refused once
 * billing is enforced.
 */
export function assertPlanChoice(args: {
  paymentLinkId: string | null;
  isBillingAvailable: boolean;
  isBillingEnforced: boolean;
}): void {
  if (args.paymentLinkId !== null && !args.isBillingAvailable) {
    throw new BillingUnavailableError();
  }
  if (
    args.paymentLinkId === null &&
    args.isBillingAvailable &&
    args.isBillingEnforced
  ) {
    throw new PlanRequiredError();
  }
}

/** The picked link, if the Workspace is offered it. */
export function findOfferedPaymentLink(
  offeredLinks: Array<PaymentLink>,
  paymentLinkId: string,
): PaymentLink {
  const paymentLink = offeredLinks.find((link) => link.id === paymentLinkId);
  if (!paymentLink) {
    throw new PlanNotOfferedError();
  }
  return paymentLink;
}

/**
 * Seats the Safes take: one per address, however many chains it is on, as
 * the `safe_seats` quota counts them.
 */
export function countSetupSeats(safes: Array<SpaceSetupSafe>): number {
  return new Set(safes.map((safe) => safe.address.toLowerCase())).size;
}

/** Seats the Workspace holds, with the ones `safes` would add. */
export async function countSeatsWith(
  spaceSafesRepository: ISpaceSafesRepository,
  args: { spaceId: Space['id']; safes: Array<SpaceSetupSafe> },
): Promise<number> {
  const addresses = args.safes.map((safe) => safe.address);
  const [held, added] = await Promise.all([
    spaceSafesRepository.countSeatsBySpaceId(args.spaceId),
    addresses.length > 0
      ? spaceSafesRepository.countNewSeats({ spaceId: args.spaceId, addresses })
      : 0,
  ]);
  return held + added;
}

/**
 * Refuses a plan whose `FEATURE_SAFE_SEATS` is below `seats`. A link with no
 * (or an unreadable) quota limits nothing; `onInvalidQuota` hears of the
 * unreadable one.
 */
export function assertSeatsFit(args: {
  paymentLink: PaymentLink;
  seats: number;
  onInvalidQuota?: (message: string) => void;
}): void {
  const quota = parseSafeSeatQuota(
    args.paymentLink.metadata,
    args.onInvalidQuota,
  );
  if (quota !== null && args.seats > quota) {
    throw new NotEnoughSeatsError();
  }
}
