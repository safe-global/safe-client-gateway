import { RelayLegacyDtoSchema } from '@/routes/relay/entities/relay.legacy.dto.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('RelayLegacyDtoSchema', () => {
  it('should validate a valid legacy relay DTO with a gasLimit', () => {
    const relayLegacyDto = {
      chainId: faker.string.numeric(),
      to: getAddress(faker.finance.ethereumAddress()),
      data: faker.string.hexadecimal(),
      gasLimit: faker.string.numeric(),
    };

    const result = RelayLegacyDtoSchema.safeParse(relayLegacyDto);

    expect(result.success && result.data.chainId).toBe(relayLegacyDto.chainId);
    expect(result.success && result.data.to).toBe(relayLegacyDto.to);
    expect(result.success && result.data.data).toBe(relayLegacyDto.data);
    expect(result.success && result.data.gasLimit).toBe(
      relayLegacyDto.gasLimit,
    );
  });

  it('should validate a valid legacy relay DTO without a gasLimit and coerce it to null', () => {
    const relayLegacyDto = {
      chainId: faker.string.numeric(),
      to: getAddress(faker.finance.ethereumAddress()),
      data: faker.string.hexadecimal(),
    };

    const result = RelayLegacyDtoSchema.safeParse(relayLegacyDto);

    expect(result.success && result.data.chainId).toBe(relayLegacyDto.chainId);
    expect(result.success && result.data.to).toBe(relayLegacyDto.to);
    expect(result.success && result.data.data).toBe(relayLegacyDto.data);
    expect(result.success && result.data.gasLimit).toBeNull(); // Coerced to null
  });

  it('should checksum a non-checksummed to address', () => {
    const relayLegacyDto = {
      chainId: faker.string.numeric(),
      to: faker.finance.ethereumAddress().toLowerCase(),
      data: faker.string.hexadecimal(),
    };

    const result = RelayLegacyDtoSchema.safeParse(relayLegacyDto);

    expect(result.success && result.data.to).toBe(
      getAddress(relayLegacyDto.to),
    );
  });

  it('should throw for a non-numeric chainId', () => {
    const relayLegacyDto = {
      chainId: faker.string.alphanumeric(),
      to: getAddress(faker.finance.ethereumAddress()),
      data: faker.string.hexadecimal(),
    };

    const result = RelayLegacyDtoSchema.safeParse(relayLegacyDto);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid input',
        path: ['chainId'],
      },
    ]);
  });

  it('should throw for a non-address to address', () => {
    const relayLegacyDto = {
      chainId: faker.string.numeric(),
      to: faker.string.numeric(),
      data: faker.string.hexadecimal(),
    };

    const result = RelayLegacyDtoSchema.safeParse(relayLegacyDto);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid input',
        path: ['to'],
      },
    ]);
  });

  it('should throw for non-hex data', () => {
    const relayLegacyDto = {
      chainId: faker.string.numeric(),
      to: getAddress(faker.finance.ethereumAddress()),
      data: faker.string.numeric(),
    };

    const result = RelayLegacyDtoSchema.safeParse(relayLegacyDto);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid input',
        path: ['data'],
      },
    ]);
  });

  it('should throw for an invalid gasLimit', () => {
    const relayLegacyDto = {
      chainId: faker.string.numeric(),
      to: getAddress(faker.finance.ethereumAddress()),
      data: faker.string.hexadecimal(),
      gasLimit: faker.number.int(),
    };

    const result = RelayLegacyDtoSchema.safeParse(relayLegacyDto);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Expected string, received number',
        path: ['gasLimit'],
        received: 'number',
      },
    ]);
  });
});
