// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { policyConfirmationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import {
  PolicyConfirmationPageSchema,
  PolicyConfirmationSchema,
} from '@/modules/policies/domain/entities/policy-confirmation.entity';

describe('PolicyConfirmationSchema', () => {
  it('should validate a policy confirmation', () => {
    const confirmation = policyConfirmationBuilder().build();

    const result = PolicyConfirmationSchema.safeParse(confirmation);

    expect(result.success).toBe(true);
  });

  it('should checksum addresses', () => {
    const nonChecksummed = faker.finance.ethereumAddress().toLowerCase();
    const confirmation = policyConfirmationBuilder()
      .with('safe', nonChecksummed as `0x${string}`)
      .build();

    const result = PolicyConfirmationSchema.parse(confirmation);

    expect(result.safe).toBe(getAddress(nonChecksummed));
  });

  it.each([
    'data' as const,
    'dataDecoded' as const,
  ])('should default a missing %s to null', (field) => {
    const { [field]: _omitted, ...confirmation } =
      policyConfirmationBuilder().build();

    const result = PolicyConfirmationSchema.parse(confirmation);

    expect(result[field]).toBeNull();
  });

  it('should keep an unknown policy `dataDecoded` payload as-is', () => {
    const confirmation = policyConfirmationBuilder()
      .with('dataDecoded', {
        policyName: 'SomeFuturePolicy',
        parameters: { anything: [1, 2, 3] },
      })
      .build();

    const result = PolicyConfirmationSchema.parse(confirmation);

    expect(result.dataDecoded).toStrictEqual({
      policyName: 'SomeFuturePolicy',
      parameters: { anything: [1, 2, 3] },
    });
  });

  it('should coerce the timestamp to a Date', () => {
    const timestamp = faker.date.recent();
    const confirmation = {
      ...policyConfirmationBuilder().build(),
      timestamp: timestamp.toISOString() as unknown as Date,
    };

    const result = PolicyConfirmationSchema.parse(confirmation);

    expect(result.timestamp).toStrictEqual(timestamp);
  });

  it('should not validate an unknown operation', () => {
    const confirmation = policyConfirmationBuilder()
      .with('operation', 'UNKNOWN' as never)
      .build();

    const result = PolicyConfirmationSchema.safeParse(confirmation);

    expect(result.success).toBe(false);
  });

  it('should not validate a non-hex selector', () => {
    const confirmation = policyConfirmationBuilder()
      .with('selector', 'a9059cbb' as never)
      .build();

    const result = PolicyConfirmationSchema.safeParse(confirmation);

    expect(result.success).toBe(false);
  });

  describe('PolicyConfirmationPageSchema', () => {
    it('should drop invalid results, leaving the upstream count untouched', () => {
      const valid = policyConfirmationBuilder().build();

      const result = PolicyConfirmationPageSchema.parse({
        count: 2,
        next: null,
        previous: null,
        results: [valid, { safe: 'not-an-address' }],
      });

      expect(result.results).toHaveLength(1);
      // `buildLenientPageSchema` does not recompute `count`, so it cannot be
      // used to drive pagination - the repository pages on `next` instead.
      expect(result.count).toBe(2);
    });
  });
});
