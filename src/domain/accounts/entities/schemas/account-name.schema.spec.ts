import { AccountNameSchema } from '@/domain/accounts/entities/schemas/account-name.schema';
import { faker } from '@faker-js/faker/.';
import { ZodError } from 'zod';

describe('AccountNameSchema', () => {
  it('should validate a valid account name', () => {
    const accountName = 'a-valid_Account.name';

    const result = AccountNameSchema.safeParse(accountName);

    expect(result.success && result.data).toBe(accountName);
  });

  it('should not validate an non-string name', () => {
    const name = 123;

    const result = AccountNameSchema.safeParse(name);

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
    const result = AccountNameSchema.safeParse(null);

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

  it('should not validate an account name shorter than 3 characters', () => {
    const accountName = faker.string.alphanumeric(2);

    const result = AccountNameSchema.safeParse(accountName);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'too_small',
          minimum: 3,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'Account names must be at least 3 characters long',
          path: [],
        },
      ]),
    );
  });

  it('should not validate an account name larger than 20 characters', () => {
    const accountName = faker.string.alphanumeric(21);

    const result = AccountNameSchema.safeParse(accountName);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'too_big',
          maximum: 20,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'Account names must be at most 20 characters long',
          path: [],
        },
      ]),
    );
  });

  it('should not validate an account name containing not allowed characters', () => {
    const forbiddenCharsString = '!@#$%^&*()';
    const accountName = `${faker.string.alphanumeric(2)}${faker.string.fromCharacters(forbiddenCharsString)}${faker.string.alphanumeric(2)}`;

    const result = AccountNameSchema.safeParse(accountName);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          validation: 'regex',
          code: 'invalid_string',
          message:
            'Account names must start with a letter or number and can contain alphanumeric characters, periods, underscores, or hyphens',
          path: [],
        },
      ]),
    );
  });
});
