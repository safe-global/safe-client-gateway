// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import {
  policyConfirmationBuilder,
  rawPolicyConfirmation,
} from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import {
  PolicyConfirmationPageSchema,
  PolicyConfirmationSchema,
  PolicyOperation,
} from '@/modules/policies/domain/entities/policy-confirmation.entity';

describe('PolicyConfirmationSchema', () => {
  it('should validate a policy confirmation', () => {
    const confirmation = rawPolicyConfirmation(
      policyConfirmationBuilder().build(),
    );

    const result = PolicyConfirmationSchema.safeParse(confirmation);

    expect(result.success).toBe(true);
  });

  it('should checksum addresses', () => {
    const nonChecksummed = faker.finance.ethereumAddress().toLowerCase();
    const confirmation = rawPolicyConfirmation(
      policyConfirmationBuilder()
        .with('safe', nonChecksummed as `0x${string}`)
        .build(),
    );

    const result = PolicyConfirmationSchema.parse(confirmation);

    expect(result.safe).toBe(getAddress(nonChecksummed));
  });

  it.each([
    'data' as const,
    'dataDecoded' as const,
  ])('should default a missing %s to null', (field) => {
    const { [field]: _omitted, ...confirmation } = rawPolicyConfirmation(
      policyConfirmationBuilder().build(),
    );

    const result = PolicyConfirmationSchema.parse(confirmation);

    expect(result[field]).toBeNull();
  });

  it('should keep an unknown policy `dataDecoded` payload as-is', () => {
    const confirmation = rawPolicyConfirmation(
      policyConfirmationBuilder()
        .with('dataDecoded', {
          policyName: 'SomeFuturePolicy',
          parameters: { anything: [1, 2, 3] },
        })
        .build(),
    );

    const result = PolicyConfirmationSchema.parse(confirmation);

    expect(result.dataDecoded).toStrictEqual({
      policyName: 'SomeFuturePolicy',
      parameters: { anything: [1, 2, 3] },
    });
  });

  it('should coerce the timestamp to a Date', () => {
    const timestamp = faker.date.recent();
    const confirmation = {
      ...rawPolicyConfirmation(policyConfirmationBuilder().build()),
      timestamp: timestamp.toISOString(),
    };

    const result = PolicyConfirmationSchema.parse(confirmation);

    expect(result.timestamp).toStrictEqual(timestamp);
  });

  it.each([
    [0, PolicyOperation.Call],
    [1, PolicyOperation.DelegateCall],
  ])('should map the numeric operation %s to %s', (value, expected) => {
    const confirmation = {
      ...rawPolicyConfirmation(policyConfirmationBuilder().build()),
      operation: value,
    };

    const result = PolicyConfirmationSchema.parse(confirmation);

    expect(result.operation).toBe(expected);
  });

  it('should keep an unmodelled policyType rather than failing', () => {
    const confirmation = {
      ...rawPolicyConfirmation(policyConfirmationBuilder().build()),
      policyType: 'SomeFuturePolicy',
    };

    const result = PolicyConfirmationSchema.parse(confirmation);

    expect(result.policyType).toBe('SomeFuturePolicy');
  });

  it('should default a missing policyType to null', () => {
    const { policyType: _omitted, ...confirmation } = rawPolicyConfirmation(
      policyConfirmationBuilder().build(),
    );

    const result = PolicyConfirmationSchema.parse(confirmation);

    expect(result.policyType).toBeNull();
  });

  it('should not validate an operation sent as its name', () => {
    // The Transaction Service serializes the numeric value; accepting the name
    // would hide a contract change rather than surface it.
    const confirmation = {
      ...rawPolicyConfirmation(policyConfirmationBuilder().build()),
      operation: PolicyOperation.Call,
    };

    const result = PolicyConfirmationSchema.safeParse(confirmation);

    expect(result.success).toBe(false);
  });

  it('should not validate an out-of-range operation', () => {
    const confirmation = {
      ...rawPolicyConfirmation(policyConfirmationBuilder().build()),
      operation: 2,
    };

    const result = PolicyConfirmationSchema.safeParse(confirmation);

    expect(result.success).toBe(false);
  });

  it('should not validate an unknown operation', () => {
    const confirmation = {
      ...rawPolicyConfirmation(policyConfirmationBuilder().build()),
      operation: 'UNKNOWN',
    };

    const result = PolicyConfirmationSchema.safeParse(confirmation);

    expect(result.success).toBe(false);
  });

  it('should not validate a non-hex selector', () => {
    const confirmation = rawPolicyConfirmation(
      policyConfirmationBuilder()
        .with('selector', 'a9059cbb' as never)
        .build(),
    );

    const result = PolicyConfirmationSchema.safeParse(confirmation);

    expect(result.success).toBe(false);
  });

  describe('PolicyConfirmationPageSchema', () => {
    it('should drop invalid results, leaving the upstream count untouched', () => {
      const valid = rawPolicyConfirmation(policyConfirmationBuilder().build());

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
