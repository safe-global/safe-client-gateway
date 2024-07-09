import { accountDataSettingBuilder } from '@/domain/accounts/entities/__tests__/account-data-setting.builder';
import { AccountDataSettingSchema } from '@/domain/accounts/entities/account-data-setting.entity';
import { faker } from '@faker-js/faker';

describe('AccountDataSettingSchema', () => {
  it('should verify an AccountDataSetting', () => {
    const accountDataSetting = accountDataSettingBuilder().build();

    const result = AccountDataSettingSchema.safeParse(accountDataSetting);

    expect(result.success).toBe(true);
  });

  it.each(['account_id' as const, 'account_data_type_id' as const])(
    'should not verify an AccountDataSetting with a float %s',
    (field) => {
      const accountDataSetting = accountDataSettingBuilder()
        .with(field, faker.number.float())
        .build();

      const result = AccountDataSettingSchema.safeParse(accountDataSetting);

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

  it('should not verify an AccountDataSetting with a non-boolean enabled', () => {
    const accountDataSetting = accountDataSettingBuilder().build();
    // @ts-expect-error - should be booleans
    accountDataSetting.enabled = faker.datatype.boolean().toString();

    const result = AccountDataSettingSchema.safeParse(accountDataSetting);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'boolean',
        message: 'Expected boolean, received string',
        path: ['enabled'],
        received: 'string',
      },
    ]);
  });

  it('should not verify an invalid AccountDataSetting', () => {
    const accountDataSetting = {
      invalid: 'accountDataSetting',
    };

    const result = AccountDataSettingSchema.safeParse(accountDataSetting);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['account_id'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['account_data_type_id'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'boolean',
        message: 'Required',
        path: ['enabled'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'date',
        message: 'Required',
        path: ['created_at'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'date',
        message: 'Required',
        path: ['updated_at'],
        received: 'undefined',
      },
    ]);
  });
});
