import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import { tokenBuilder } from '@/modules/bridge/domain/entities/__tests__/token.builder';
import { TokenSchema } from '@/modules/bridge/domain/entities/token.entity';

describe('TokenSchema', () => {
  it('should validate a Token', () => {
    const token = tokenBuilder().build();

    const result = TokenSchema.safeParse(token);

    expect(result.success).toBe(true);
  });

  it('should coerce chainId to string', () => {
    const chainId = faker.number.int();
    const token = tokenBuilder()
      .with('chainId', chainId as unknown as string)
      .build();

    const result = TokenSchema.safeParse(token);

    expect(result.success && result.data.chainId).toBe(String(chainId));
  });

  it('should checksum address', () => {
    const nonChecksummedAddress = faker.finance.ethereumAddress().toLowerCase();
    const token = tokenBuilder()
      .with('address', nonChecksummedAddress as Address)
      .build();

    const result = TokenSchema.safeParse(token);

    expect(result.success && result.data.address).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it.each(['coinKey' as const, 'logoURI' as const])(
    '%s should default to null',
    (key) => {
      const token = tokenBuilder().build();
      delete token[key];

      const result = TokenSchema.safeParse(token);

      expect(result.success && result.data[key]).toBe(null);
    },
  );
});
