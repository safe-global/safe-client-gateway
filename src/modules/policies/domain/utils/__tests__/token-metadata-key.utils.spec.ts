// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { tokenMetadataKey } from '@/modules/policies/domain/utils/token-metadata-key.utils';

describe('tokenMetadataKey', () => {
  it('should join the chain id and the checksummed address with a colon', () => {
    const chainId = faker.string.numeric();
    const address = getAddress(faker.finance.ethereumAddress());

    expect(tokenMetadataKey({ chainId, address })).toBe(
      `${chainId}:${address}`,
    );
  });

  it('should key the same address differently on two chains', () => {
    const address = getAddress(faker.finance.ethereumAddress());

    const first = tokenMetadataKey({ chainId: '1', address });
    const second = tokenMetadataKey({ chainId: '137', address });

    expect(first).not.toBe(second);
  });

  it('should build the same key from a lowercase and an uppercase address, once each is checksummed', () => {
    const chainId = faker.string.numeric();
    const hexBody = faker.finance.ethereumAddress().slice(2);

    const fromLowercase = getAddress(`0x${hexBody.toLowerCase()}`);
    const fromUppercase = getAddress(`0x${hexBody.toUpperCase()}`);

    expect(fromLowercase).toBe(fromUppercase);
    expect(tokenMetadataKey({ chainId, address: fromLowercase })).toBe(
      tokenMetadataKey({ chainId, address: fromUppercase }),
    );
  });
});
