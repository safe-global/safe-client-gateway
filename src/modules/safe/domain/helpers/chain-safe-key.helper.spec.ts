// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { getChainSafeKey } from '#/modules/safe/domain/helpers/chain-safe-key.helper';

describe('getChainSafeKey', () => {
  it('is the same for an address in any casing', () => {
    const chainId = faker.string.numeric();
    const address = getAddress(faker.finance.ethereumAddress());

    expect(getChainSafeKey(chainId, address)).toBe(
      getChainSafeKey(chainId, `0x${address.slice(2).toLowerCase()}`),
    );
  });

  it('differs between chains for the same address', () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const [chainId, otherChainId] = faker.helpers.uniqueArray(
      () => faker.string.numeric({ length: 3 }),
      2,
    );

    expect(getChainSafeKey(chainId, address)).not.toBe(
      getChainSafeKey(otherChainId, address),
    );
  });
});
