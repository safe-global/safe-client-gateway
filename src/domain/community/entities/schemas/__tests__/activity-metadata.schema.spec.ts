import { activityMetadataBuilder } from '@/domain/community/entities/__tests__/activity-metadata.builder';
import { ActivityMetadataSchema } from '@/domain/community/entities/activity-metadata.entity';
import { ZodError } from 'zod';

describe('ActivityMetadataSchema', () => {
  it('should validate a valid activity metadata', () => {
    const activityMetadata = activityMetadataBuilder().build();

    const result = ActivityMetadataSchema.safeParse(activityMetadata);

    expect(result.success).toBe(true);
  });

  it('should not validate an invalid activity metadata', () => {
    const activityMetadata = { invalid: 'activity metadata' };

    const result = ActivityMetadataSchema.safeParse(activityMetadata);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['name'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['description'],
          message: 'Required',
        },
        {
          code: 'invalid_type',
          expected: 'number',
          received: 'undefined',
          path: ['maxPoints'],
          message: 'Required',
        },
      ]),
    );
  });
});
