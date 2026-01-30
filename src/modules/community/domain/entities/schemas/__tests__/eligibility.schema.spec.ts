import { eligibilityBuilder } from '@/modules/community/domain/entities/__tests__/eligibility.builder';
import { EligibilitySchema } from '@/modules/community/domain/entities/eligibility.entity';

describe('EligibilitySchema', () => {
  it('should validate a valid eligibility', () => {
    const eligibility = eligibilityBuilder().build();

    const result = EligibilitySchema.safeParse(eligibility);

    expect(result.success).toBe(true);
  });

  it.each(['requestId' as const, 'isAllowed' as const, 'isVpn' as const])(
    'should not allow %s to be undefined',
    (key) => {
      const eligibility = eligibilityBuilder().build();
      delete eligibility[key];

      const result = EligibilitySchema.safeParse(eligibility);

      expect(
        !result.success &&
          result.error.issues.length === 1 &&
          result.error.issues[0].path.length === 1 &&
          result.error.issues[0].path[0] === key,
      ).toBe(true);
    },
  );

  it('should not allow non-string requestId', () => {
    const eligibility = eligibilityBuilder().build();
    // @ts-expect-error - inferred type doesn't allow non-string requestId
    eligibility.requestId = true;

    const result = EligibilitySchema.safeParse(eligibility);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['requestId'],
        message: 'Invalid input: expected string, received boolean',
      },
    ]);
  });

  it.each(['isAllowed' as const, 'isVpn' as const])(
    'should not allow %s to be non-boolean',
    (key) => {
      const eligibility = eligibilityBuilder().build();
      // @ts-expect-error - inferred type doesn't allow non-boolean keys
      eligibility[key] = 'true';

      const result = EligibilitySchema.safeParse(eligibility);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'boolean',
          path: [key],
          message: 'Invalid input: expected boolean, received string',
        },
      ]);
    },
  );
});
