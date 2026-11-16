// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { ChainIdSchema } from '#/modules/chains/domain/entities/schemas/chain-id.schema';
import { CHAIN_ID_MAXLENGTH } from '#/routes/common/constants';

describe('ChainIdSchema', () => {
  it.each(['1', '100', '11155111', faker.string.numeric({ length: 20 })])(
    'should accept %s',
    (chainId) => {
      const result = ChainIdSchema.safeParse(chainId);

      expect(result.success && result.data).toBe(chainId);
    },
  );

  it.each(['-1', '1.5', '1e3', ' 1', '0x1', '', 'abc'])(
    'should reject %j',
    (chainId) => {
      const result = ChainIdSchema.safeParse(chainId);

      expect(result.success).toBe(false);
    },
  );

  it('should reject a chain ID longer than the maximum length', () => {
    const result = ChainIdSchema.safeParse(
      faker.string.numeric({ length: CHAIN_ID_MAXLENGTH + 1 }),
    );

    expect(result.success).toBe(false);
  });
});
