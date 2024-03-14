import { safeAppsEventBuilder } from '@/routes/cache-hooks/entities/__tests__/safe-apps-update.builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { SafeAppsUpdateEventSchema } from '@/routes/cache-hooks/entities/schemas/safe-apps-update.schema';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

describe('SafeAppsUpdateEventSchema', () => {
  it('should validate a valid Safe Apps event', () => {
    const safeAppsEvent = safeAppsEventBuilder().build();

    const result = SafeAppsUpdateEventSchema.safeParse(safeAppsEvent);

    expect(result.success).toBe(true);
  });

  it('should not allow a non-SAFE_APPS_UPDATE event', () => {
    const safeAppsEvent = safeAppsEventBuilder()
      .with('type', faker.word.sample() as EventType.SAFE_APPS_UPDATE)
      .build();

    const result = SafeAppsUpdateEventSchema.safeParse(safeAppsEvent);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          received: safeAppsEvent.type,
          code: 'invalid_literal',
          expected: 'SAFE_APPS_UPDATE',
          path: ['type'],
          message: 'Invalid literal value, expected "SAFE_APPS_UPDATE"',
        },
      ]),
    );
  });

  it.each([['type' as const], ['chainId' as const]])(
    'should not allow a missing %s',
    (field) => {
      const safeAppsEvent = safeAppsEventBuilder().build();
      delete safeAppsEvent[field];

      const result = SafeAppsUpdateEventSchema.safeParse(safeAppsEvent);

      expect(
        !result.success &&
          result.error.issues.length === 1 &&
          result.error.issues[0].path.length === 1 &&
          result.error.issues[0].path[0] === field,
      ).toBe(true);
    },
  );
});
