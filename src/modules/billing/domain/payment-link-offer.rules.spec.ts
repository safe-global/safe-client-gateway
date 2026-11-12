// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  paymentLinkBuilder,
  paymentLinkPricedAt,
  trialPaymentLinkBuilder,
} from '#/datasources/billing-api/entities/__tests__/payment-link.builder';
import type { PaymentLink } from '#/datasources/billing-api/entities/payment-link.entity';
import {
  gracePeriodOf,
  isGracePeriodClaimOpen,
  isOfferedToSpace,
  offersPlan,
} from '#/modules/billing/domain/payment-link-offer.rules';

/** A trial link carrying `metadata` instead of a recognized `gracePeriod` tag. */
function trialLinkWithMetadata(metadata: Record<string, string>): PaymentLink {
  return trialPaymentLinkBuilder(true).with('metadata', metadata).build();
}

describe('payment-link offer rules', () => {
  describe('gracePeriodOf', () => {
    it('should return true for a link tagged with gracePeriod=true', () => {
      expect(gracePeriodOf(trialPaymentLinkBuilder(true).build())).toBe(true);
    });

    it('should return false for a link tagged with gracePeriod=false', () => {
      expect(gracePeriodOf(trialPaymentLinkBuilder(false).build())).toBe(false);
    });

    it('should return null when the metadata key is absent', () => {
      expect(gracePeriodOf(trialLinkWithMetadata({}))).toBeNull();
    });

    it('should return null for an unrecognized value', () => {
      expect(
        gracePeriodOf(trialLinkWithMetadata({ gracePeriod: 'garbled' })),
      ).toBeNull();
    });
  });

  describe('isGracePeriodClaimOpen', () => {
    it('should be open before the claim window ends', () => {
      const endsAt = faker.date.future();

      expect(
        isGracePeriodClaimOpen({
          now: faker.date.past({ refDate: endsAt }),
          endsAt,
        }),
      ).toBe(true);
    });

    it('should be closed exactly when the claim window ends', () => {
      const endsAt = faker.date.anytime();

      expect(isGracePeriodClaimOpen({ now: new Date(endsAt), endsAt })).toBe(
        false,
      );
    });

    it('should be closed after the claim window ends', () => {
      const endsAt = faker.date.past();

      expect(
        isGracePeriodClaimOpen({
          now: faker.date.future({ refDate: endsAt }),
          endsAt,
        }),
      ).toBe(false);
    });
  });

  describe('isOfferedToSpace', () => {
    it('should not offer a paid link to a space that has never subscribed', () => {
      const link = paymentLinkBuilder().build();

      expect(
        isOfferedToSpace(link, {
          isOfferedGracePeriod: faker.datatype.boolean(),
          hasEverSubscribed: false,
          activePlanId: null,
        }),
      ).toBe(false);
    });

    it('should offer a paid link to a space that has subscribed, when it is on no active plan', () => {
      const link = paymentLinkBuilder().build();

      expect(
        isOfferedToSpace(link, {
          isOfferedGracePeriod: faker.datatype.boolean(),
          hasEverSubscribed: true,
          activePlanId: null,
        }),
      ).toBe(true);
    });

    it('should offer a paid link whose price does not match the active plan', () => {
      const link = paymentLinkPricedAt(faker.string.alphanumeric(32)).build();

      expect(
        isOfferedToSpace(link, {
          isOfferedGracePeriod: faker.datatype.boolean(),
          hasEverSubscribed: true,
          activePlanId: faker.string.alphanumeric(32),
        }),
      ).toBe(true);
    });

    it('should not offer the paid link matching the active plan', () => {
      const planId = faker.string.alphanumeric(32);
      const link = paymentLinkPricedAt(planId).build();

      expect(
        isOfferedToSpace(link, {
          isOfferedGracePeriod: faker.datatype.boolean(),
          hasEverSubscribed: true,
          activePlanId: planId,
        }),
      ).toBe(false);
    });

    it("should offer a sibling plan sharing the active one's catalog name but not its price", () => {
      const activePlanId = faker.string.alphanumeric(32);
      const siblingPlanId = faker.string.alphanumeric(32);
      const planName = faker.commerce.productName();
      const eligibility = {
        isOfferedGracePeriod: faker.datatype.boolean(),
        hasEverSubscribed: true,
        activePlanId,
      };
      // The active plan's own link — same catalog name, its own price.
      const activeLink = paymentLinkPricedAt(activePlanId)
        .with('metadata', { planName })
        .build();
      // A sibling tier sharing that name at a different price: PLA-2003's bug
      // excluded this one too, matching by name instead of price.
      const siblingLink = paymentLinkPricedAt(siblingPlanId)
        .with('metadata', { planName })
        .build();

      expect(isOfferedToSpace(activeLink, eligibility)).toBe(false);
      expect(isOfferedToSpace(siblingLink, eligibility)).toBe(true);
    });

    it('should offer the legacy grace to a space offered it', () => {
      const link = trialPaymentLinkBuilder(true).build();

      expect(
        isOfferedToSpace(link, {
          isOfferedGracePeriod: true,
          hasEverSubscribed: false,
          activePlanId: null,
        }),
      ).toBe(true);
    });

    it('should not offer the standard trial to a space offered the legacy grace', () => {
      const link = trialPaymentLinkBuilder(false).build();

      expect(
        isOfferedToSpace(link, {
          isOfferedGracePeriod: true,
          hasEverSubscribed: false,
          activePlanId: null,
        }),
      ).toBe(false);
    });

    it('should offer the standard trial to a space not offered the legacy grace', () => {
      const link = trialPaymentLinkBuilder(false).build();

      expect(
        isOfferedToSpace(link, {
          isOfferedGracePeriod: false,
          hasEverSubscribed: false,
          activePlanId: null,
        }),
      ).toBe(true);
    });

    it('should not offer the legacy grace to a space not offered it', () => {
      const link = trialPaymentLinkBuilder(true).build();

      expect(
        isOfferedToSpace(link, {
          isOfferedGracePeriod: false,
          hasEverSubscribed: false,
          activePlanId: null,
        }),
      ).toBe(false);
    });

    it.each([true, false])(
      'should not offer a trial link (gracePeriod=%s) to a space that has ever subscribed',
      (gracePeriod) => {
        const link = trialPaymentLinkBuilder(gracePeriod).build();

        expect(
          isOfferedToSpace(link, {
            isOfferedGracePeriod: true,
            hasEverSubscribed: true,
            activePlanId: null,
          }),
        ).toBe(false);
        expect(
          isOfferedToSpace(link, {
            isOfferedGracePeriod: false,
            hasEverSubscribed: true,
            activePlanId: null,
          }),
        ).toBe(false);
      },
    );

    it('should not offer a trial link with no gracePeriod metadata', () => {
      const link = trialLinkWithMetadata({});

      expect(
        isOfferedToSpace(link, {
          isOfferedGracePeriod: true,
          hasEverSubscribed: false,
          activePlanId: null,
        }),
      ).toBe(false);
      expect(
        isOfferedToSpace(link, {
          isOfferedGracePeriod: false,
          hasEverSubscribed: false,
          activePlanId: null,
        }),
      ).toBe(false);
    });
  });

  describe('offersPlan', () => {
    it('should match a link priced at the plan', () => {
      const planId = faker.string.alphanumeric(32);

      expect(offersPlan(paymentLinkPricedAt(planId).build(), planId)).toBe(
        true,
      );
    });

    it('should not match a link priced at another plan', () => {
      const link = paymentLinkPricedAt(faker.string.alphanumeric(32)).build();

      expect(offersPlan(link, faker.string.alphanumeric(32))).toBe(false);
    });

    it('should not match a link whose line items the upstream omitted', () => {
      const planId = faker.string.alphanumeric(32);
      const link = paymentLinkBuilder().with('lineItems', undefined).build();

      expect(offersPlan(link, planId)).toBe(false);
    });
  });
});
