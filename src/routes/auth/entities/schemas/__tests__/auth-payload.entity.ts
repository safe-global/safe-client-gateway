import { AuthPayloadSchema } from '@/routes/auth/entities/auth-payload.entity';
import { authPayloadBuilder } from '@/routes/auth/entities/schemas/__tests__/auth-payload.entity.builder';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('AuthPayloadSchema', () => {
  it('should parse a valid AuthPayloadSchema', () => {
    const authPayload = authPayloadBuilder().build();

    const result = AuthPayloadSchema.safeParse(authPayload);

    expect(result.success).toBe(true);
    // Address did not checksum as it already way
    expect(result.success && result.data).toStrictEqual(authPayload);
  });

  it('should checksum the signer_address', () => {
    const nonChecksummedAddress = faker.finance.ethereumAddress().toLowerCase();
    const authPayload = authPayloadBuilder()
      .with('signer_address', nonChecksummedAddress as `0x${string}`)
      .build();

    const result = AuthPayloadSchema.safeParse(authPayload);

    expect(result.success && result.data.signer_address).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it('should not allow a non-numeric chain_id', () => {
    const authPayload = authPayloadBuilder()
      .with('chain_id', faker.lorem.word())
      .build();

    const result = AuthPayloadSchema.safeParse(authPayload);

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
    const authPayload = authPayloadBuilder()
      .with('signer_address', faker.lorem.word() as `0x${string}`)
      .build();

    const result = AuthPayloadSchema.safeParse(authPayload);

    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid address',
        path: ['signer_address'],
      },
    ]);
  });

  it('should not parse an invalid AuthPayloadSchema', () => {
    const authPayload = {
      unknown: 'payload',
    };

    const result = AuthPayloadSchema.safeParse(authPayload);

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
