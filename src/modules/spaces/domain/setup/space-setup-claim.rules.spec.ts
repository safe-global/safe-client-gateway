// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { isClaimable } from '#/modules/spaces/domain/setup/space-setup-claim.rules';

describe('isClaimable', () => {
  const now = new Date();
  const leaseSeconds = faker.number.int({ min: 60, max: 300 });
  const withinLease = new Date(now.getTime() - (leaseSeconds - 1) * 1_000);
  const pastLease = new Date(now.getTime() - (leaseSeconds + 1) * 1_000);

  it('claims a pending setup', () => {
    expect(
      isClaimable({ status: 'PENDING', updatedAt: now }, { now, leaseSeconds }),
    ).toBe(true);
  });

  it('leaves a setup another apply holds within its lease', () => {
    expect(
      isClaimable(
        { status: 'APPLYING', updatedAt: withinLease },
        { now, leaseSeconds },
      ),
    ).toBe(false);
  });

  it('takes over a setup stuck in APPLYING past its lease', () => {
    expect(
      isClaimable(
        { status: 'APPLYING', updatedAt: pastLease },
        { now, leaseSeconds },
      ),
    ).toBe(true);
  });

  it('never claims an applied setup', () => {
    expect(
      isClaimable(
        { status: 'APPLIED', updatedAt: pastLease },
        { now, leaseSeconds },
      ),
    ).toBe(false);
  });
});
