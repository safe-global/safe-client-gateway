import { accountDataTypeBuilder } from '@/domain/accounts/entities/__tests__/account-data-type.builder';
import { AccountDataTypeSchema } from '@/domain/accounts/entities/account-data-type.entity';
import { faker } from '@faker-js/faker';

describe('AccountDataTypeSchema', () => {
  it('should verify an AccountDataType', () => {
    const accountDataType = accountDataTypeBuilder().build();

    const result = AccountDataTypeSchema.safeParse(accountDataType);

    expect(result.success).toBe(true);
  });

  it.each(['id' as const])(
    'should not verify an AccountDataType with a float %s',
    (field) => {
      const accountDataType = accountDataTypeBuilder()
        .with(field, faker.number.float())
        .build();

      const result = AccountDataTypeSchema.safeParse(accountDataType);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'integer',
          message: 'Expected integer, received float',
          path: [field],
          received: 'float',
        },
      ]);
    },
  );

  it('should not verify an AccountDataType with a integer description', () => {
    const accountDataType = accountDataTypeBuilder().build();
    // @ts-expect-error - should be strings
    accountDataType['description'] = faker.number.int();

    const result = AccountDataTypeSchema.safeParse(accountDataType);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Expected string, received number',
        path: ['description'],
        received: 'number',
      },
    ]);
  });

  it('should not verify an AccountDataType with a random name', () => {
    const accountDataType = accountDataTypeBuilder().build();
    const randomName = faker.string.sample();
    // @ts-expect-error - should be strings
    accountDataType['name'] = randomName;

    const result = AccountDataTypeSchema.safeParse(accountDataType);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_enum_value',
        message: `Invalid enum value. Expected 'CounterfactualSafes' | 'AddressBook' | 'Watchlist', received '${randomName}'`,
        options: ['CounterfactualSafes', 'AddressBook', 'Watchlist'],
        path: ['name'],
        received: randomName,
      },
    ]);
  });

  it('should not verify an AccountDataType with a non-boolean is_active', () => {
    const accountDataType = accountDataTypeBuilder().build();
    // @ts-expect-error - should be booleans
    accountDataType.is_active = faker.datatype.boolean().toString();

    const result = AccountDataTypeSchema.safeParse(accountDataType);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'boolean',
        message: 'Expected boolean, received string',
        path: ['is_active'],
        received: 'string',
      },
    ]);
  });

  it('should not verify an invalid AccountDataType', () => {
    const dataType = {
      invalid: 'dataType',
    };

    const result = AccountDataTypeSchema.safeParse(dataType);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'number',
        received: 'undefined',
        path: ['id'],
        message: 'Required',
      },
      {
        code: 'invalid_date',
        path: ['created_at'],
        message: 'Invalid date',
      },
      {
        code: 'invalid_date',
        path: ['updated_at'],
        message: 'Invalid date',
      },
      {
        code: 'invalid_type',
        expected: "'CounterfactualSafes' | 'AddressBook' | 'Watchlist'",
        received: 'undefined',
        path: ['name'],
        message: 'Required',
      },
    ]);
  });
});
