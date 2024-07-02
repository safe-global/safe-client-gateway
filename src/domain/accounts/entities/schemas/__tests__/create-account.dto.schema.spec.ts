import { createAccountDtoBuilder } from '@/domain/accounts/entities/__tests__/create-account.dto.builder';
import { CreateAccountDtoSchema } from '@/domain/accounts/entities/schemas/create-account.dto.schema';
import { ZodError } from 'zod';

describe('CreateAccountDtoSchema', () => {
  it('should validate a valid CreateAccountDto', () => {
    const createAccountDto = createAccountDtoBuilder().build();

    const result = CreateAccountDtoSchema.safeParse(createAccountDto);

    expect(result.success).toBe(true);
  });

  it('should not validate an invalid CreateAccountDto', () => {
    const createAccountDto = { invalid: 'createAccountDto' };

    const result = CreateAccountDtoSchema.safeParse(createAccountDto);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['address'],
          message: 'Required',
        },
      ]),
    );
  });

  describe('address', () => {
    it('should not validate an invalid address', () => {
      const createAccountDto = createAccountDtoBuilder().build();
      // @ts-expect-error - address is expected to be a ETH address
      createAccountDto.address = 'invalid address';

      const result = CreateAccountDtoSchema.safeParse(createAccountDto);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'custom',
            message: 'Invalid address',
            path: ['address'],
          },
        ]),
      );
    });

    it('should not validate without an address', () => {
      const createAccountDto = createAccountDtoBuilder().build();
      // @ts-expect-error - inferred type doesn't allow optional properties
      delete createAccountDto.address;

      const result = CreateAccountDtoSchema.safeParse(createAccountDto);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['address'],
            message: 'Required',
          },
        ]),
      );
    });
  });
});
