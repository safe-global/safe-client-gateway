import { JwtAccessTokenPayloadSchema } from '@/routes/auth/entities/jwt-access-token.payload.entity';
import { jwtAccessTokenPayloadBuilder } from '@/routes/auth/entities/schemas/__tests__/jwt-access-token.payload.builder';
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

  it('should not allow a non-address signer_address', () => {
    const jwtAccessTokenPayload = jwtAccessTokenPayloadBuilder()
      .with('signer_address', faker.lorem.word() as `0x${string}`)
      .build();

    const result = JwtAccessTokenPayloadSchema.safeParse(jwtAccessTokenPayload);

    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid input',
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
        path: ['signer_address'],
        received: 'undefined',
      },
    ]);
  });
});
