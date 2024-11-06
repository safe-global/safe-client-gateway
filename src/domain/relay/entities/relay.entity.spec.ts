import { RelaySchema } from '@/domain/relay/entities/relay.entity';
import { faker } from '@faker-js/faker';

// Note: no builder exists for Relay as it is only tested here
describe('RelaySchema', () => {
  it('should validate a Relay', () => {
    const relay = {
      taskId: faker.string.alphanumeric(),
    };

    const result = RelaySchema.safeParse(relay);

    expect(result.success).toBe(true);
  });

  it('should not validate a Relay with missing taskId', () => {
    const relay = {};

    const result = RelaySchema.safeParse(relay);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'invalid_type',
      expected: 'string',
      message: 'Required',
      path: ['taskId'],
      received: 'undefined',
    });
  });

  it('should not validate a Relay with invalid taskId', () => {
    const relay = {
      taskId: faker.number.int(),
    };

    const result = RelaySchema.safeParse(relay);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'invalid_type',
      expected: 'string',
      message: 'Expected string, received number',
      path: ['taskId'],
      received: 'number',
    });
  });

  it('should not validate an invalid Relay', () => {
    const relay = {
      invalid: 'relay',
    };

    const result = RelaySchema.safeParse(relay);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(!result.success && result.error.issues[0]).toStrictEqual({
      code: 'invalid_type',
      expected: 'string',
      message: 'Required',
      path: ['taskId'],
      received: 'undefined',
    });
  });
});
