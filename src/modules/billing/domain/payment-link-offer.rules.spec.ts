// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  paymentLinkBuilder,
  paymentLinkPricedAt,
  trialPaymentLinkBuilder,
} from '@/datasources/billing-api/entities/__tests__/payment-link.builder';
import type { PaymentLink } from '@/datasources/billing-api/entities/payment-link.entity';
import {
  gracePeriodOf,
  hasSeatCapacity,
  isOfferedToSpace,
  offersPlan,
} from '@/modules/billing/domain/payment-link-offer.rules';

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

  describe('isOfferedToSpace', () => {
    it('should not offer a paid link to a space that has never subscribed', () => {
      const link = paymentLinkBuilder().build();

      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: faker.datatype.boolean(),
          hasEverSubscribed: false,
          activePlanId: null,
        }),
      ).toBe(false);
    });

    it('should offer a paid link to a space that has subscribed, when it is on no active plan', () => {
      const link = paymentLinkBuilder().build();

      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: faker.datatype.boolean(),
          hasEverSubscribed: true,
          activePlanId: null,
        }),
      ).toBe(true);
    });

    it('should offer a paid link whose price does not match the active plan', () => {
      const link = paymentLinkPricedAt(faker.string.alphanumeric(32)).build();

      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: faker.datatype.boolean(),
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
          createdBeforeEnforcement: faker.datatype.boolean(),
          hasEverSubscribed: true,
          activePlanId: planId,
        }),
      ).toBe(false);
    });

    it("should offer a sibling plan sharing the active one's catalog name but not its price", () => {
      const planId = faker.string.alphanumeric(32);
      const activePlanId = faker.string.alphanumeric(32);
      const link = paymentLinkPricedAt(planId)
        .with('metadata', { planName: 'Business' })
        .build();

      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: faker.datatype.boolean(),
          hasEverSubscribed: true,
          activePlanId,
        }),
      ).toBe(true);
    });

    it('should offer the legacy grace to a space created before enforcement', () => {
      const link = trialPaymentLinkBuilder(true).build();

      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: true,
          hasEverSubscribed: false,
          activePlanId: null,
        }),
      ).toBe(true);
    });

    it('should not offer the standard trial to a space created before enforcement', () => {
      const link = trialPaymentLinkBuilder(false).build();

      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: true,
          hasEverSubscribed: false,
          activePlanId: null,
        }),
      ).toBe(false);
    });

    it('should offer the standard trial to a space created from enforcement on', () => {
      const link = trialPaymentLinkBuilder(false).build();

      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: false,
          hasEverSubscribed: false,
          activePlanId: null,
        }),
      ).toBe(true);
    });

    it('should not offer the legacy grace to a space created from enforcement on', () => {
      const link = trialPaymentLinkBuilder(true).build();

      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: false,
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
            createdBeforeEnforcement: true,
            hasEverSubscribed: true,
            activePlanId: null,
          }),
        ).toBe(false);
        expect(
          isOfferedToSpace(link, {
            createdBeforeEnforcement: false,
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
          createdBeforeEnforcement: true,
          hasEverSubscribed: false,
          activePlanId: null,
        }),
      ).toBe(false);
      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: false,
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

  describe('hasSeatCapacity', () => {
    it('should have capacity when the link carries no seat quota', () => {
      const link = paymentLinkBuilder().with('metadata', {}).build();

      expect(hasSeatCapacity(link, faker.number.int())).toBe(true);
    });

    it('should have capacity when the link is tagged unlimited', () => {
      const link = paymentLinkBuilder()
        .with('metadata', { FEATURE_SAFE_SEATS: 'unlimited' })
        .build();

      expect(hasSeatCapacity(link, faker.number.int())).toBe(true);
    });

    it('should have capacity when the used count is within quota', () => {
      const link = paymentLinkBuilder()
        .with('metadata', { FEATURE_SAFE_SEATS: '3' })
        .build();

      expect(hasSeatCapacity(link, 3)).toBe(true);
    });

    it('should not have capacity when the used count exceeds quota', () => {
      const link = paymentLinkBuilder()
        .with('metadata', { FEATURE_SAFE_SEATS: '3' })
        .build();

      expect(hasSeatCapacity(link, 4)).toBe(false);
    });
  });
});
