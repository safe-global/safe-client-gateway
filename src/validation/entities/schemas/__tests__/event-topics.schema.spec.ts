import { EventTopicsSchema } from '@/validation/entities/schemas/event-topics.schema';
import { faker } from '@faker-js/faker/.';

describe('EventTopicsSchema', () => {
  it('validate an EventTopicsSchema', () => {
    const eventTopics = Array.from(
      { length: faker.number.int({ min: 1, max: 5 }) },
      () => faker.string.hexadecimal() as `0x${string}`,
    );

    const result = EventTopicsSchema.safeParse(eventTopics);

    expect(result.success).toBe(true);
  });

  it('should not allow missing event signatures', () => {
    const result = EventTopicsSchema.safeParse([]);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'too_small',
      minimum: 1,
      type: 'array',
      inclusive: true,
      exact: false,
      message: 'No event signature found',
      path: [],
    });
  });

  it('should not allow non-hex topics', () => {
    const topics = Array.from(
      { length: faker.number.int({ min: 1, max: 5 }) },
      () => faker.string.alpha() as `0x${string}`,
    );

    const result = EventTopicsSchema.safeParse(topics);

    expect(!result.success && result.error.issues.length).toBe(topics.length);
    expect(!result.success && result.error.issues).toStrictEqual(
      Array.from({ length: topics.length }, (_, i) => {
        return {
          code: 'custom',
          message: 'Invalid "0x" notated hex string',
          path: [i],
        };
      }),
    );
  });

  it('should not validate an invalid EventTopicsSchema', () => {
    const eventTopics = {
      invalid: 'eventTopics',
    };

    const result = EventTopicsSchema.safeParse(eventTopics);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'invalid_type',
      expected: 'array',
      message: 'Expected array, received object',
      path: [],
      received: 'object',
    });
  });
});
