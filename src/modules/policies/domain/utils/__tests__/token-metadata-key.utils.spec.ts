// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { tokenMetadataKey } from '@/modules/policies/domain/utils/token-metadata-key.utils';

describe('tokenMetadataKey', () => {
  it('should join the chain id and the lowercased address with a colon', () => {
    const chainId = faker.string.numeric();
    const address = getAddress(faker.finance.ethereumAddress());

    expect(tokenMetadataKey({ chainId, address })).toBe(
      `${chainId}:${address.toLowerCase()}`,
    );
  });

  it('should build the same key regardless of the address casing', () => {
    const chainId = faker.string.numeric();
    const address = getAddress(faker.finance.ethereumAddress());
    const lowercased: `0x${string}` = `0x${address.slice(2).toLowerCase()}`;

    expect(tokenMetadataKey({ chainId, address })).toBe(
      tokenMetadataKey({ chainId, address: lowercased }),
    );
  });

  it('should key the same address differently on two chains', () => {
    const address = getAddress(faker.finance.ethereumAddress());

    const first = tokenMetadataKey({ chainId: '1', address });
    const second = tokenMetadataKey({ chainId: '137', address });

    expect(first).not.toBe(second);
  });
});
