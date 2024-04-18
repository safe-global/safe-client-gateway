import { JwtAccessTokenPayloadSchema } from '@/domain/auth/entities/jwt-access-token.payload.entity';
import { jwtAccessTokenPayloadBuilder } from '@/domain/auth/entities/schemas/__tests__/jwt-access-token.payload.builder';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('JwtAccessTokenSchema', () => {
  it('should parse a valid JwtAccessTokenSchema', () => {
    const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder().build();

    const result = JwtAccessTokenPayloadSchema.safeParse(jwtAccessTokenPayload);

    expect(result.success).toBe(true);
    // Address did not checksum as it already way
    expect(result.success && result.data).toStrictEqual(jwtAccessTokenPayload);
  });

  it('should checksum the signer_address', () => {
    const nonChecksummedAddress = faker.finance.ethereumAddress().toLowerCase();
    const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder()
      .with('signer_address', nonChecksummedAddress as `0x${string}`)
      .build();

    const result = JwtAccessTokenPayloadSchema.safeParse(jwtAccessTokenPayload);

    expect(result.success && result.data.signer_address).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should not allow a non-numeric chain_id', () => {
    const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder()
      .with('chain_id', faker.lorem.word())
      .build();

    const result = JwtAccessTokenPayloadSchema.safeParse(jwtAccessTokenPayload);

    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid base-10 numeric string',
        path: ['chain_id'],
      },
    ]);
  });

  it('should not allow a non-address signer_address', () => {
    const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder()
      .with('signer_address', faker.lorem.word() as `0x${string}`)
      .build();

    const result = JwtAccessTokenPayloadSchema.safeParse(jwtAccessTokenPayload);

    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid address',
        path: ['signer_address'],
      },
    ]);
  });

  it('should not parse an invalid JwtAccessTokenSchema', () => {
    const jwtAccessTokenPayload = {
      unknown: 'payload',
    };

    const result = JwtAccessTokenPayloadSchema.safeParse(jwtAccessTokenPayload);

    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['chain_id'],
        received: 'undefined',
      },
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Required',
        path: ['signer_address'],
        received: 'undefined',
      },
    ]);
  });
});
