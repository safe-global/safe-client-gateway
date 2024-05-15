import { activityMetadataBuilder } from '@/domain/locking/entities/__tests__/activity-metadata.builder';
import { ActivityMetadataSchema } from '@/domain/locking/entities/schemas/activity-metadata.schema';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

describe('ActivityMetadataSchema', () => {
  it('should validate a valid activity metadata', () => {
    const activityMetadata = activityMetadataBuilder().build();

    const result = ActivityMetadataSchema.safeParse(activityMetadata);

    expect(result.success).toBe(true);
  });

  it('should not allow a non-numeric string for maxPoints', () => {
    const activityMetadata = activityMetadataBuilder()
      .with('maxPoints', faker.string.alpha())
      .build();

    const result = ActivityMetadataSchema.safeParse(activityMetadata);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'custom',
          message: 'Invalid base-10 numeric string',
          path: ['maxPoints'],
        },
      ]),
    );
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
          path: ['campaignId'],
          message: 'Required',
        },
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
          expected: 'string',
          received: 'undefined',
          path: ['maxPoints'],
          message: 'Required',
        },
      ]),
    );
  });
});
