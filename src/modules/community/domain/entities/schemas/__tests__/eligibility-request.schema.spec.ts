import { eligibilityRequestBuilder } from '@/modules/community/domain/entities/__tests__/eligibility-request.builder';
import { EligibilityRequestSchema } from '@/modules/community/domain/entities/eligibility-request.entity';

describe('EligibilityRequestSchema', () => {
  it('should validate a valid eligibility request', () => {
    const eligibilityRequest = eligibilityRequestBuilder().build();

    const result = EligibilityRequestSchema.safeParse(eligibilityRequest);

    expect(result.success).toBe(true);
  });

  it.each(['requestId' as const, 'sealedData' as const])(
    'should not allow %s to be undefined',
    (key) => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      delete eligibilityRequest[key];

      const result = EligibilityRequestSchema.safeParse(eligibilityRequest);

      expect(
        !result.success &&
          result.error.issues.length === 1 &&
          result.error.issues[0].path.length === 1 &&
          result.error.issues[0].path[0] === key,
      ).toBe(true);
    },
  );

  it.each(['requestId' as const, 'sealedData' as const])(
    'should not allow a non-string %s',
    (key) => {
      const eligibilityRequest = eligibilityRequestBuilder().build();
      // @ts-expect-error - inferred type doesn't allow non-string keys
      eligibilityRequest[key] = true;

      const result = EligibilityRequestSchema.safeParse(eligibilityRequest);

      expect(
        !result.success &&
          result.error.issues.length === 1 &&
          result.error.issues[0].path.length === 1 &&
          result.error.issues[0].path[0] === key,
      ).toBe(true);
    },
  );
});
