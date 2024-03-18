import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { TokenSchema } from '@/domain/tokens/entities/schemas/token.schema';
import { Token } from '@/domain/tokens/entities/token.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('TokenSchema', () => {
  it('should validate a token', () => {
    const token = tokenBuilder().build();

    const result = TokenSchema.safeParse(token);

    expect(result.success).toBe(true);
  });

  it('should checksum address', () => {
    const nonChecksummedAddress = faker.finance
      .ethereumAddress()
      .toLowerCase() as `0x${string}`;
    const token = tokenBuilder().with('address', nonChecksummedAddress).build();

    const result = TokenSchema.safeParse(token);

    expect(result.success && result.data['address']).toBe(
      getAddress(nonChecksummedAddress),
    );
  });

  it.each<keyof Token>([
    'address',
    'logoUri',
    'name',
    'symbol',
    'type',
    'trusted',
  ])('should not allow %s to be undefined', (key) => {
    const token = tokenBuilder().build();
    delete token[key];

    const result = TokenSchema.safeParse(token);

    expect(
      !result.success &&
        result.error.issues.length === 1 &&
        result.error.issues[0].path.length === 1 &&
        result.error.issues[0].path[0] === key,
    ).toBe(true);
  });
});
