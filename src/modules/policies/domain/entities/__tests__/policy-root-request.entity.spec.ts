// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { policyRootRequestBuilder } from '@/modules/policies/domain/entities/__tests__/policy-root-request.builder';
import {
  PolicyRootRequestPageSchema,
  PolicyRootRequestSchema,
  PolicyRootRequestStatus,
} from '@/modules/policies/domain/entities/policy-root-request.entity';

describe('PolicyRootRequestSchema', () => {
  it.each(
    Object.values(PolicyRootRequestStatus),
  )('should validate a %s root request', (status) => {
    const rootRequest = policyRootRequestBuilder()
      .with('status', status)
      .build();

    const result = PolicyRootRequestSchema.safeParse(rootRequest);

    expect(result.success).toBe(true);
  });

  it('should default a missing invalidatedAt to null', () => {
    const { invalidatedAt: _invalidatedAt, ...rootRequest } =
      policyRootRequestBuilder().build();

    const result = PolicyRootRequestSchema.parse(rootRequest);

    expect(result.invalidatedAt).toBeNull();
  });

  it('should coerce validFrom to a Date', () => {
    const validFrom = faker.date.soon();
    const rootRequest = {
      ...policyRootRequestBuilder().build(),
      validFrom: validFrom.toISOString() as unknown as Date,
    };

    const result = PolicyRootRequestSchema.parse(rootRequest);

    expect(result.validFrom).toStrictEqual(validFrom);
  });

  it('should not validate an unknown status', () => {
    const rootRequest = policyRootRequestBuilder()
      .with('status', 'applied' as never)
      .build();

    const result = PolicyRootRequestSchema.safeParse(rootRequest);

    expect(result.success).toBe(false);
  });

  describe('PolicyRootRequestPageSchema', () => {
    it('should drop invalid results', () => {
      const valid = policyRootRequestBuilder().build();

      const result = PolicyRootRequestPageSchema.parse({
        count: 2,
        next: null,
        previous: null,
        results: [valid, { root: 'not-hex' }],
      });

      expect(result.results).toHaveLength(1);
    });
  });
});
