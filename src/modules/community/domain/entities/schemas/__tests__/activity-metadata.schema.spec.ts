import { activityMetadataBuilder } from '@/modules/community/domain/entities/__tests__/activity-metadata.builder';
import { ActivityMetadataSchema } from '@/modules/community/domain/entities/activity-metadata.entity';

describe('ActivityMetadataSchema', () => {
  it('should validate a valid activity metadata', () => {
    const activityMetadata = activityMetadataBuilder().build();

    const result = ActivityMetadataSchema.safeParse(activityMetadata);

    expect(result.success).toBe(true);
  });

  it('should not validate an invalid activity metadata', () => {
    const activityMetadata = { invalid: 'activity metadata' };

    const result = ActivityMetadataSchema.safeParse(activityMetadata);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['name'],
        message: 'Invalid input: expected string, received undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        path: ['description'],
        message: 'Invalid input: expected string, received undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        path: ['maxPoints'],
        message: 'Invalid input: expected number, received undefined',
      },
    ]);
  });
});
