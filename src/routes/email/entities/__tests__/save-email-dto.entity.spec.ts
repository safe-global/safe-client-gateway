import {
  SaveEmailDto,
  SaveEmailDtoSchema,
} from '@/routes/email/entities/save-email-dto.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('SaveEmailDtoSchema', () => {
  it('should allow a valid SaveEmailDto', () => {
    const saveEmailDto: SaveEmailDto = {
      emailAddress: faker.internet.email(),
      signer: getAddress(faker.finance.ethereumAddress()),
    };

    const result = SaveEmailDtoSchema.safeParse(saveEmailDto);

    expect(result.success).toBe(true);
  });

  it('should not allow a non-email emailAddress', () => {
    const saveEmailDto: SaveEmailDto = {
      emailAddress: faker.lorem.word(),
      signer: getAddress(faker.finance.ethereumAddress()),
    };

    const result = SaveEmailDtoSchema.safeParse(saveEmailDto);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_string',
        message: 'Invalid email',
        path: ['emailAddress'],
        validation: 'email',
      },
    ]);
  });

  it('should not allow a non-Ethereum address signer', () => {
    const saveEmailDto: SaveEmailDto = {
      emailAddress: faker.internet.email(),
      signer: faker.string.alphanumeric() as `0x${string}`,
    };

    const result = SaveEmailDtoSchema.safeParse(saveEmailDto);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid address',
        path: ['signer'],
      },
    ]);
  });

  it('should checksum the signer', () => {
    const saveEmailDto: SaveEmailDto = {
      emailAddress: faker.internet.email(),
      signer: faker.finance.ethereumAddress().toLowerCase() as `0x${string}`, // not checksummed
    };

    const result = SaveEmailDtoSchema.safeParse(saveEmailDto);

    expect(result.success && result.data.signer).toBe(
      getAddress(saveEmailDto.signer),
    );
  });
});
