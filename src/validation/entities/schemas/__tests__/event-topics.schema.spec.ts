import { EventTopicsSchema } from '@/validation/entities/schemas/event-topics.schema';
import { faker } from '@faker-js/faker/.';

describe('EventTopicsSchema', () => {
  it('validate an EventTopicsSchema', () => {
    const eventTopics = faker.helpers.multiple(
      () => faker.string.hexadecimal() as `0x${string}`,
      { count: { min: 1, max: 5 } },
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
    const topics = faker.helpers.multiple(
      () => faker.string.alpha() as `0x${string}`,
      { count: { min: 1, max: 5 } },
    );

    const result = EventTopicsSchema.safeParse(topics);

    expect(!result.success && result.error.issues.length).toBe(topics.length);
    expect(!result.success && result.error.issues).toStrictEqual(
      faker.helpers.multiple(
        (_, i) => {
          return {
            code: 'custom',
            message: 'Invalid "0x" notated hex string',
            path: [i],
          };
        },
        { count: topics.length },
      ),
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
