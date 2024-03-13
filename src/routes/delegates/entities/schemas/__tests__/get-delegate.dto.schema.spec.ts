import { GetDelegateDtoSchema } from '@/routes/delegates/entities/schemas/get-delegate.dto.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('GetDelegateDtoSchema', () => {
  it('should validate a valid GetDelegateDto', () => {
    const getDelegateDto = {
      safe: getAddress(faker.finance.ethereumAddress()),
      delegate: getAddress(faker.finance.ethereumAddress()),
      delegator: getAddress(faker.finance.ethereumAddress()),
      label: faker.lorem.word(),
    };

    const result = GetDelegateDtoSchema.safeParse(getDelegateDto);

    expect(result.success).toBe(true);
  });

  it.each([
    ['safe', getAddress(faker.finance.ethereumAddress())],
    ['delegate', getAddress(faker.finance.ethereumAddress())],
    ['delegator', getAddress(faker.finance.ethereumAddress())],
    ['label', faker.lorem.word()],
  ])('should validate with at least %s defined', (property, value) => {
    const getDelegateDto = { [property]: value };

    const result = GetDelegateDtoSchema.safeParse(getDelegateDto);

    expect(result.success).toBe(true);
  });

  it.each([['safe' as const], ['delegate' as const], ['delegator' as const]])(
    'should checksum %s' as const,
    (property) => {
      const nonCheckSummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const getDelegateDto = { [property]: nonCheckSummedAddress };

      const result = GetDelegateDtoSchema.safeParse(getDelegateDto);

      expect(result.success && result.data[property]).toBe(
        getAddress(nonCheckSummedAddress),
      );
    },
  );

  it('should not allow invalid GetDelegateDto objects', () => {
    const getDelegateDto = { invalid: 'getDelegateDto' };

    const result = GetDelegateDtoSchema.safeParse(getDelegateDto);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'custom',
          message: 'At least one property is required',
          path: [],
        },
      ]),
    );
  });
});
