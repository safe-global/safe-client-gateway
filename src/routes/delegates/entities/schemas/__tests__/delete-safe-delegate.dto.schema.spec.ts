import { deleteSafeDelegateDtoBuilder } from '@/routes/delegates/entities/__tests__/delete-safe-delegate.dto.builder';
import { DeleteSafeDelegateDto } from '@/routes/delegates/entities/delete-safe-delegate.dto.entity';
import { DeleteSafeDelegateDtoSchema } from '@/routes/delegates/entities/schemas/delete-safe-delegate.dto.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('DeleteSafeDelegateDtoSchema', () => {
  it('should validate a DeleteSafeDelegateDto', () => {
    const deleteSafeDelegateDto = deleteSafeDelegateDtoBuilder().build();

    const result = DeleteSafeDelegateDtoSchema.safeParse(deleteSafeDelegateDto);

    expect(result.success).toBe(true);
  });

  it.each(['delegate' as const, 'safe' as const])(
    'should checksum %s',
    (key) => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase() as `0x${string}`;
      const deleteSafeDelegateDto = deleteSafeDelegateDtoBuilder()
        .with(key, nonChecksummedAddress)
        .build();

      const result = DeleteSafeDelegateDtoSchema.safeParse(
        deleteSafeDelegateDto,
      );

      expect(result.success && result.data[key]).toBe(
        getAddress(nonChecksummedAddress),
      );
    },
  );

  it.each<keyof DeleteSafeDelegateDto>(['delegate', 'safe', 'signature'])(
    `should not allow %s to be undefined`,
    (key) => {
      const deleteSafeDelegateDto = deleteSafeDelegateDtoBuilder().build();
      delete deleteSafeDelegateDto[key];

      const result = DeleteSafeDelegateDtoSchema.safeParse(
        deleteSafeDelegateDto,
      );

      expect(!result.success && result.error.issues).toStrictEqual(
        expect.objectContaining([
          {
            code: 'invalid_type',
            expected: expect.any(String),
            received: 'undefined',
            path: [key],
            message: 'Required',
          },
        ]),
      );
    },
  );
});
