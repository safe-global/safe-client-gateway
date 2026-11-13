// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import { paymentLinkBuilder } from '#/datasources/billing-api/entities/__tests__/payment-link.builder';
import type { PaymentLink } from '#/datasources/billing-api/entities/payment-link.entity';
import type { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { spaceSetupSafeBuilder } from '#/modules/spaces/domain/setup/entities/__tests__/space-setup.builder';
import { BillingUnavailableError } from '#/modules/spaces/domain/setup/errors/billing-unavailable.error';
import { NotEnoughSeatsError } from '#/modules/spaces/domain/setup/errors/not-enough-seats.error';
import { PlanNotOfferedError } from '#/modules/spaces/domain/setup/errors/plan-not-offered.error';
import { PlanRequiredError } from '#/modules/spaces/domain/setup/errors/plan-required.error';
import {
  assertPlanChoice,
  assertSeatsFit,
  countSeatsWith,
  countSetupSeats,
  findOfferedPaymentLink,
} from '#/modules/spaces/domain/setup/space-setup-plan.rules';

describe('space setup plan rules', () => {
  describe('assertPlanChoice', () => {
    it('accepts a plan while billing is available, enforced or not', () => {
      for (const isBillingEnforced of [true, false]) {
        expect(() =>
          assertPlanChoice({
            paymentLinkId: faker.string.alphanumeric(16),
            isBillingAvailable: true,
            isBillingEnforced,
          }),
        ).not.toThrow();
      }
    });

    it('refuses a plan without billing', () => {
      expect(() =>
        assertPlanChoice({
          paymentLinkId: faker.string.alphanumeric(16),
          isBillingAvailable: false,
          isBillingEnforced: false,
        }),
      ).toThrow(BillingUnavailableError);
    });

    it('refuses no plan once billing is enforced', () => {
      expect(() =>
        assertPlanChoice({
          paymentLinkId: null,
          isBillingAvailable: true,
          isBillingEnforced: true,
        }),
      ).toThrow(PlanRequiredError);
    });

    it('accepts no plan before enforcement or without billing', () => {
      for (const isBillingAvailable of [true, false]) {
        expect(() =>
          assertPlanChoice({
            paymentLinkId: null,
            isBillingAvailable,
            isBillingEnforced: false,
          }),
        ).not.toThrow();
      }
    });
  });

  describe('findOfferedPaymentLink', () => {
    it('returns the offered link with that id', () => {
      const links = faker.helpers.multiple(() => paymentLinkBuilder().build(), {
        count: 3,
      });

      expect(findOfferedPaymentLink(links, links[1].id)).toBe(links[1]);
    });

    it('refuses an id that is not offered', () => {
      expect(() =>
        findOfferedPaymentLink(
          [paymentLinkBuilder().build()],
          faker.string.alphanumeric(16),
        ),
      ).toThrow(PlanNotOfferedError);
    });
  });

  describe('countSetupSeats', () => {
    it('counts one seat per address, however many chains it is on', () => {
      const safe = spaceSetupSafeBuilder().build();
      const other = spaceSetupSafeBuilder().build();

      expect(
        countSetupSeats([
          safe,
          { ...safe, chainId: `${safe.chainId}0` },
          other,
        ]),
      ).toBe(2);
    });

    it('counts no seat for no Safe', () => {
      expect(countSetupSeats([])).toBe(0);
    });
  });

  describe('countSeatsWith', () => {
    const spaceId = faker.number.int({ min: 1 });
    let spaceSafesRepository: MockedObject<ISpaceSafesRepository>;

    beforeEach(() => {
      spaceSafesRepository = {
        countSeatsBySpaceId: vi.fn(),
        countNewSeats: vi.fn(),
      } as MockedObject<ISpaceSafesRepository>;
    });

    it('adds the seats the Safes would take to the seats held', async () => {
      const held = faker.number.int({ min: 0, max: 10 });
      const added = faker.number.int({ min: 1, max: 10 });
      const safes = [spaceSetupSafeBuilder().build()];
      spaceSafesRepository.countSeatsBySpaceId.mockResolvedValue(held);
      spaceSafesRepository.countNewSeats.mockResolvedValue(added);

      await expect(
        countSeatsWith(spaceSafesRepository, { spaceId, safes }),
      ).resolves.toBe(held + added);
      expect(spaceSafesRepository.countNewSeats).toHaveBeenCalledWith({
        spaceId,
        addresses: [safes[0].address],
      });
    });

    it('counts only the seats held when there is no Safe to add', async () => {
      const held = faker.number.int({ min: 0, max: 10 });
      spaceSafesRepository.countSeatsBySpaceId.mockResolvedValue(held);

      await expect(
        countSeatsWith(spaceSafesRepository, { spaceId, safes: [] }),
      ).resolves.toBe(held);
      expect(spaceSafesRepository.countNewSeats).not.toHaveBeenCalled();
    });
  });

  describe('assertSeatsFit', () => {
    function linkWithSeats(seats: string): PaymentLink {
      return paymentLinkBuilder()
        .with('metadata', { FEATURE_SAFE_SEATS: seats })
        .build();
    }

    it('accepts as many seats as the plan has', () => {
      expect(() =>
        assertSeatsFit({ paymentLink: linkWithSeats('3'), seats: 3 }),
      ).not.toThrow();
    });

    it('refuses more seats than the plan has', () => {
      expect(() =>
        assertSeatsFit({ paymentLink: linkWithSeats('3'), seats: 4 }),
      ).toThrow(NotEnoughSeatsError);
    });

    it('limits nothing for a link without a seat quota', () => {
      expect(() =>
        assertSeatsFit({
          paymentLink: paymentLinkBuilder().with('metadata', {}).build(),
          seats: faker.number.int({ min: 1, max: 1_000 }),
        }),
      ).not.toThrow();
    });

    it('limits nothing for an unreadable quota, and reports it', () => {
      const onInvalidQuota = vi.fn();

      expect(() =>
        assertSeatsFit({
          paymentLink: linkWithSeats('ten'),
          seats: 11,
          onInvalidQuota,
        }),
      ).not.toThrow();
      expect(onInvalidQuota).toHaveBeenCalledOnce();
    });
  });
});
