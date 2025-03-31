import { NameSchema } from '@/domain/common/entities/name.schema';
import { faker } from '@faker-js/faker/.';
import { ZodError } from 'zod';

describe('NameSchema', () => {
  it('should validate a valid name', () => {
    const accountName = 'a-valid_Account.name';

    const result = NameSchema.safeParse(accountName);

    expect(result.success && result.data).toBe(accountName);
  });

  it('should not validate an non-string name', () => {
    const name = 123;

    const result = NameSchema.safeParse(name);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: [],
          message: 'Expected string, received number',
        },
      ]),
    );
  });

  it('should not validate null name', () => {
    const result = NameSchema.safeParse(null);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'null',
          path: [],
          message: 'Expected string, received null',
        },
      ]),
    );
  });

  it('should not validate an name shorter than 3 characters', () => {
    const accountName = faker.string.alphanumeric(2);

    const result = NameSchema.safeParse(accountName);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'too_small',
          minimum: 3,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'Names must be at least 3 characters long',
          path: [],
        },
      ]),
    );
  });

  it('should not validate an name larger than 30 characters', () => {
    const accountName = faker.string.alphanumeric(31);

    const result = NameSchema.safeParse(accountName);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'too_big',
          maximum: 30,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'Names must be at most 30 characters long',
          path: [],
        },
      ]),
    );
  });

  it('should not validate an name containing not allowed characters', () => {
    const forbiddenCharsString = '!@#$%^&*()';
    const accountName = `${faker.string.alphanumeric(2)}${faker.string.fromCharacters(forbiddenCharsString)}${faker.string.alphanumeric(2)}`;

    const result = NameSchema.safeParse(accountName);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          validation: 'regex',
          code: 'invalid_string',
          message:
            'Names must start with a letter or number and can contain alphanumeric characters, spaces, periods, underscores, or hyphens',
          path: [],
        },
      ]),
    );
  });
});
