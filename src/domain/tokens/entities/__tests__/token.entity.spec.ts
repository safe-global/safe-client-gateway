import {
  erc20TokenBuilder,
  erc721TokenBuilder,
  nativeTokenBuilder,
  tokenBuilder,
} from '@/domain/tokens/__tests__/token.builder';
import { TokenSchema } from '@/domain/tokens/entities/token.entity';
import type { Token } from '@/domain/tokens/entities/token.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('Token', () => {
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

  it('should not allow native tokens to have undefined decimals', () => {
    const token = nativeTokenBuilder().build();
    // @ts-expect-error - inferred type does not allow undefined decimals
    delete token.decimals;

    const result = TokenSchema.safeParse(token);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Required',
        path: ['decimals'],
        received: 'undefined',
      },
    ]);
  });

  it('should default ERC-20 decimals to 0', () => {
    const token = erc20TokenBuilder().build();
    // @ts-expect-error - inferred type does not allow undefined decimals
    delete token.decimals;

    const result = TokenSchema.safeParse(token);

    expect(result.success && result.data.decimals).toBe(0);
  });

  it('should default ERC-721 decimals to 0', () => {
    const token = erc721TokenBuilder().build();
    // @ts-expect-error - inferred type does not allow undefined decimals
    delete token.decimals;

    const result = TokenSchema.safeParse(token);

    expect(result.success && result.data.decimals).toBe(0);
  });
});
