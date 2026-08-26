// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  paymentLinkBuilder,
  trialPaymentLinkBuilder,
} from '@/datasources/billing-api/entities/__tests__/payment-link.builder';
import type { PaymentLink } from '@/datasources/billing-api/entities/payment-link.entity';
import {
  gracePeriodOf,
  isOfferedToSpace,
  planNameOf,
} from '@/modules/billing/domain/payment-link-offer.rules';

/** A trial link carrying `metadata` instead of a recognized `gracePeriod` tag. */
function trialLinkWithMetadata(metadata: Record<string, string>): PaymentLink {
  return trialPaymentLinkBuilder(true).with('metadata', metadata).build();
}

/** A paid link, optionally tagged with a `planName`. */
function paidLinkWithPlan(planName: string | null): PaymentLink {
  return paymentLinkBuilder()
    .with('metadata', planName === null ? {} : { planName })
    .build();
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

  describe('planNameOf', () => {
    it('should return the plan name the link carries', () => {
      const planName = faker.commerce.productName();

      expect(planNameOf(paidLinkWithPlan(planName))).toBe(planName);
    });

    it('should return null when the metadata key is absent', () => {
      expect(planNameOf(paidLinkWithPlan(null))).toBeNull();
    });
  });

  describe('isOfferedToSpace', () => {
    it('should not offer a paid link to a space that has never subscribed', () => {
      const link = paidLinkWithPlan(null);

      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: faker.datatype.boolean(),
          hasEverSubscribed: false,
          activePlanName: null,
        }),
      ).toBe(false);
    });

    it('should offer a paid link to a space that has subscribed, when it is on no active plan', () => {
      const link = paidLinkWithPlan(faker.commerce.productName());

      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: faker.datatype.boolean(),
          hasEverSubscribed: true,
          activePlanName: null,
        }),
      ).toBe(true);
    });

    it('should offer a paid link whose plan does not match the active one', () => {
      const link = paidLinkWithPlan('Business');

      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: faker.datatype.boolean(),
          hasEverSubscribed: true,
          activePlanName: 'Starter',
        }),
      ).toBe(true);
    });

    it('should not offer the paid link matching the active plan', () => {
      const planName = faker.commerce.productName();
      const link = paidLinkWithPlan(planName);

      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: faker.datatype.boolean(),
          hasEverSubscribed: true,
          activePlanName: planName,
        }),
      ).toBe(false);
    });

    it('should offer an untagged paid link even when the space is on an active plan', () => {
      const link = paidLinkWithPlan(null);

      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: faker.datatype.boolean(),
          hasEverSubscribed: true,
          activePlanName: faker.commerce.productName(),
        }),
      ).toBe(true);
    });

    it('should offer the legacy grace to a space created before enforcement', () => {
      const link = trialPaymentLinkBuilder(true).build();

      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: true,
          hasEverSubscribed: false,
          activePlanName: null,
        }),
      ).toBe(true);
    });

    it('should not offer the standard trial to a space created before enforcement', () => {
      const link = trialPaymentLinkBuilder(false).build();

      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: true,
          hasEverSubscribed: false,
          activePlanName: null,
        }),
      ).toBe(false);
    });

    it('should offer the standard trial to a space created from enforcement on', () => {
      const link = trialPaymentLinkBuilder(false).build();

      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: false,
          hasEverSubscribed: false,
          activePlanName: null,
        }),
      ).toBe(true);
    });

    it('should not offer the legacy grace to a space created from enforcement on', () => {
      const link = trialPaymentLinkBuilder(true).build();

      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: false,
          hasEverSubscribed: false,
          activePlanName: null,
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
            activePlanName: null,
          }),
        ).toBe(false);
        expect(
          isOfferedToSpace(link, {
            createdBeforeEnforcement: false,
            hasEverSubscribed: true,
            activePlanName: null,
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
          activePlanName: null,
        }),
      ).toBe(false);
      expect(
        isOfferedToSpace(link, {
          createdBeforeEnforcement: false,
          hasEverSubscribed: false,
          activePlanName: null,
        }),
      ).toBe(false);
    });
  });
});
