// SPDX-License-Identifier: FSL-1.1-MIT
import type { SpaceSetupRow } from '#/modules/spaces/domain/setup/entities/space-setup.entity';

const MILLISECONDS_PER_SECOND = 1_000;

/** Far above a normal apply (seconds), so only an apply that died loses its claim. */
export const SETUP_APPLY_LEASE_SECONDS = 120;

/**
 * Whether an apply may claim the setup: it is pending, or an earlier apply
 * claimed it more than `leaseSeconds` ago and never finished — it crashed or
 * failed, so the setup is taken over rather than left half-applied.
 */
export function isClaimable(
  setup: Pick<SpaceSetupRow, 'status' | 'updatedAt'>,
  args: { now: Date; leaseSeconds: number },
): boolean {
  switch (setup.status) {
    case 'PENDING':
      return true;
    case 'APPLYING':
      return (
        args.now.getTime() - setup.updatedAt.getTime() >
        args.leaseSeconds * MILLISECONDS_PER_SECOND
      );
    case 'APPLIED':
      return false;
  }
}
