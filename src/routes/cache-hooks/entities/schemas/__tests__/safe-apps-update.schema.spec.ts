import { SafeAppsUpdateEventSchema } from '@/routes/cache-hooks/entities/schemas/safe-apps-update.schema';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

describe('SafeAppsUpdateEventSchema', () => {
  it('should validate a valid Safe Apps event', () => {
    const safeAppsEvent = {
      type: 'SAFE_APPS_UPDATE',
      chainId: faker.string.numeric(),
    };

    const result = SafeAppsUpdateEventSchema.safeParse(safeAppsEvent);

    expect(result.success).toBe(true);
  });

  it('should not allow an invalid Safe Apps event', () => {
    const invalidSafeAppsEvent = {
      invalid: 'safeAppsEvent',
    };

    const result = SafeAppsUpdateEventSchema.safeParse(invalidSafeAppsEvent);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        // @ts-expect-error - no type inferral for literal
        {
          code: 'invalid_literal',
          expected: 'SAFE_APPS_UPDATE',
          path: ['type'],
          message: 'Invalid literal value, expected "SAFE_APPS_UPDATE"',
        },
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['chainId'],
          message: 'Required',
        },
      ]),
    );
  });
});
