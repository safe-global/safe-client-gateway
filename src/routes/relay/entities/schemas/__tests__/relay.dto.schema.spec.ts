import { RelayDtoSchema } from '@/routes/relay/entities/schemas/relay.dto.schema';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('RelayDtoSchema', () => {
  it('should validate a valid relay DTO without a gasLimit and coerce it to null', () => {
    const relayDto = {
      to: getAddress(faker.finance.ethereumAddress()),
      data: faker.string.hexadecimal(),
      version: faker.system.semver(),
    };

    const result = RelayDtoSchema.safeParse(relayDto);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('RelayDtoSchema failed to validate a valid request.');
    }
    expect(result.data.to).toBe(relayDto.to);
    expect(result.data.data).toBe(relayDto.data);
    expect(result.data.version).toBe(relayDto.version);
    expect(result.data.gasLimit).toBeNull(); // Coerced to null
  });

  it('should validate a valid relay DTO with a gasLimit and coerce it to BigInt', () => {
    const relayDto = {
      to: getAddress(faker.finance.ethereumAddress()),
      data: faker.string.hexadecimal(),
      version: faker.system.semver(),
      gasLimit: faker.string.numeric(),
    };

    const result = RelayDtoSchema.safeParse(relayDto);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('RelayDtoSchema failed to validate a valid request.');
    }
    expect(result.data.to).toBe(relayDto.to);
    expect(result.data.data).toBe(relayDto.data);
    expect(result.data.version).toBe(relayDto.version);
    expect(result.data.gasLimit).toBe(BigInt(relayDto.gasLimit)); // Coerced to BigInt
  });

  it('should refine a non-checksummed to address', () => {
    const relayDto = {
      to: faker.finance.ethereumAddress().toLowerCase(),
      data: faker.string.hexadecimal(),
      version: faker.system.semver(),
    };

    const result = RelayDtoSchema.safeParse(relayDto);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('RelayDtoSchema failed to validate a valid request.');
    }
    expect(result.data.to).toBe(getAddress(relayDto.to));
  });

  it('should throw for an invalid to address', () => {
    const relayDto = {
      to: faker.string.numeric(),
      data: faker.string.hexadecimal(),
      version: faker.system.semver(),
    };

    const result = RelayDtoSchema.safeParse(relayDto);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('RelayDtoSchema validated an invalid request.');
    }
    expect(result.error.issues).toStrictEqual([
      { code: 'custom', message: 'Invalid input', path: ['to'] },
    ]);
  });

  it('should throw for invalid data', () => {
    const relayDto = {
      to: getAddress(faker.finance.ethereumAddress()),
      data: faker.string.numeric(),
      version: faker.system.semver(),
    };

    const result = RelayDtoSchema.safeParse(relayDto);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('RelayDtoSchema validated an invalid request.');
    }
    expect(result.error.issues).toStrictEqual([
      { code: 'custom', message: 'Invalid input', path: ['data'] },
    ]);
  });

  it('should throw for an invalid version', () => {
    const relayDto = {
      to: getAddress(faker.finance.ethereumAddress()),
      data: faker.string.hexadecimal(),
      version: faker.string.numeric(),
    };

    const result = RelayDtoSchema.safeParse(relayDto);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('RelayDtoSchema validated an invalid request.');
    }
    expect(result.error.issues).toStrictEqual([
      { code: 'custom', message: 'Invalid input', path: ['version'] },
    ]);
  });

  it('should throw for an invalid gasLimit', () => {
    const relayDto = {
      to: getAddress(faker.finance.ethereumAddress()),
      data: faker.string.hexadecimal(),
      version: faker.system.semver(),
      gasLimit: faker.string.alpha(),
    };

    const result = RelayDtoSchema.safeParse(relayDto);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('RelayDtoSchema validated an invalid request.');
    }
    expect(result.error.issues).toStrictEqual([
      { code: 'custom', message: 'Invalid input', path: ['gasLimit'] },
    ]);
  });
});
