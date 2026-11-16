// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { ClsServiceManager } from 'nestjs-cls';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '#/logging/logging.interface';
import type { ContractsRepository } from '#/modules/contracts/domain/contracts.repository';
import { contractBuilder } from '#/modules/data-decoder/domain/v2/entities/__tests__/contract.builder';
import { tokenBuilder } from '#/modules/tokens/domain/__tests__/token.builder';
import type { TokenRepository } from '#/modules/tokens/domain/token.repository';
import {
  AddressInfoHelper,
  MAX_REQUEST_LOOKUPS,
} from '#/routes/common/address-info/address-info.helper';

describe('AddressInfoHelper', () => {
  let target: AddressInfoHelper;

  const contractsRepository = vi.mocked({
    getContract: vi.fn(),
  } as MockedObject<ContractsRepository>);
  const tokenRepository = vi.mocked({
    getToken: vi.fn(),
  } as MockedObject<TokenRepository>);
  const loggingService = vi.mocked({
    debug: vi.fn(),
  } as MockedObject<ILoggingService>);
  const cls = ClsServiceManager.getClsService();

  beforeEach(() => {
    vi.resetAllMocks();
    target = new AddressInfoHelper(
      contractsRepository,
      tokenRepository,
      loggingService,
      cls,
    );
  });

  describe('get', () => {
    it('should return the first source if found', async () => {
      const chainId = faker.string.numeric();
      const contract = contractBuilder()
        .with('displayName', faker.word.sample())
        .build();
      contractsRepository.getContract.mockResolvedValue(contract);

      const result = await target.get(chainId, contract.address, [
        'CONTRACT',
        'TOKEN',
      ]);

      expect(result).toEqual({
        value: contract.address,
        name: contract.displayName,
        logoUri: contract.logoUrl,
      });
      expect(contractsRepository.getContract).toHaveBeenCalledWith({
        chainId,
        contractAddress: contract.address,
      });
    });

    it('should return the next source if the first one fails', async () => {
      const chainId = faker.string.numeric();
      const token = tokenBuilder().build();
      contractsRepository.getContract.mockRejectedValue(new Error('Not found'));
      tokenRepository.getToken.mockResolvedValue(token);

      const result = await target.get(chainId, token.address, [
        'CONTRACT',
        'TOKEN',
      ]);

      expect(result).toEqual({
        value: token.address,
        name: token.name,
        logoUri: token.logoUri,
      });
      expect(contractsRepository.getContract).toHaveBeenCalledWith({
        chainId,
        contractAddress: token.address,
      });
      expect(tokenRepository.getToken).toHaveBeenCalledWith({
        chainId,
        address: token.address,
      });
    });

    it('should fall back to returning the name of contracts if displayName is not available', async () => {
      const chainId = faker.string.numeric();
      const contract = contractBuilder().with('displayName', '').build();
      contractsRepository.getContract.mockResolvedValue(contract);

      const result = await target.get(chainId, contract.address, ['CONTRACT']);

      expect(result).toEqual({
        value: contract.address,
        name: contract.name,
        logoUri: contract.logoUrl,
      });
      expect(contractsRepository.getContract).toHaveBeenCalledWith({
        chainId,
        contractAddress: contract.address,
      });
    });
  });

  describe('get within a request', () => {
    it('should look an address up once', async () => {
      const chainId = faker.string.numeric();
      const token = tokenBuilder().build();
      tokenRepository.getToken.mockResolvedValue(token);

      const results = await cls.run(async () => [
        await target.get(chainId, token.address, ['TOKEN']),
        await target.get(chainId, token.address, ['TOKEN']),
      ]);

      expect(results).toEqual([
        { value: token.address, name: token.name, logoUri: token.logoUri },
        { value: token.address, name: token.name, logoUri: token.logoUri },
      ]);
      expect(tokenRepository.getToken).toHaveBeenCalledTimes(1);
    });

    it('should share a lookup that is still pending', async () => {
      const chainId = faker.string.numeric();
      const token = tokenBuilder().build();
      tokenRepository.getToken.mockResolvedValue(token);

      await cls.run(() =>
        Promise.all([
          target.get(chainId, token.address, ['TOKEN']),
          target.get(chainId, token.address, ['TOKEN']),
        ]),
      );

      expect(tokenRepository.getToken).toHaveBeenCalledTimes(1);
    });

    it('should not look an address up again after the lookup failed', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      tokenRepository.getToken.mockRejectedValue(new Error('Not found'));

      const results = await cls.run(async () => [
        await target.getOrDefault(chainId, address, ['TOKEN']),
        await target.getOrDefault(chainId, address, ['TOKEN']),
      ]);

      expect(results).toEqual([
        { value: address, name: null, logoUri: null },
        { value: address, name: null, logoUri: null },
      ]);
      expect(tokenRepository.getToken).toHaveBeenCalledTimes(1);
    });

    it('should look up another address, chain or list of sources', async () => {
      const chainId = faker.string.numeric();
      const token = tokenBuilder().build();
      const otherToken = tokenBuilder().build();
      tokenRepository.getToken.mockResolvedValue(token);
      contractsRepository.getContract.mockRejectedValue(new Error('Not found'));

      await cls.run(async () => {
        await target.get(chainId, token.address, ['TOKEN']);
        await target.get(chainId, otherToken.address, ['TOKEN']);
        await target.get(`${chainId}1`, token.address, ['TOKEN']);
        await target.get(chainId, token.address, ['CONTRACT', 'TOKEN']);
      });

      expect(tokenRepository.getToken).toHaveBeenCalledTimes(4);
      expect(tokenRepository.getToken).toHaveBeenNthCalledWith(1, {
        chainId,
        address: token.address,
      });
      expect(tokenRepository.getToken).toHaveBeenNthCalledWith(2, {
        chainId,
        address: otherToken.address,
      });
      expect(tokenRepository.getToken).toHaveBeenNthCalledWith(3, {
        chainId: `${chainId}1`,
        address: token.address,
      });
      expect(tokenRepository.getToken).toHaveBeenNthCalledWith(4, {
        chainId,
        address: token.address,
      });
    });

    it('should stop remembering lookups once it holds the maximum', async () => {
      const chainId = faker.string.numeric();
      const token = tokenBuilder().build();
      const addresses = faker.helpers.uniqueArray(
        () => getAddress(faker.finance.ethereumAddress()),
        MAX_REQUEST_LOOKUPS,
      );
      tokenRepository.getToken.mockResolvedValue(token);

      await cls.run(async () => {
        for (const address of addresses) {
          await target.get(chainId, address, ['TOKEN']);
        }
        await target.get(chainId, addresses[0], ['TOKEN']);
        await target.get(chainId, token.address, ['TOKEN']);
        await target.get(chainId, token.address, ['TOKEN']);
      });

      expect(tokenRepository.getToken).toHaveBeenCalledTimes(
        MAX_REQUEST_LOOKUPS + 2,
      );
    });

    it('should look an address up again in another request', async () => {
      const chainId = faker.string.numeric();
      const token = tokenBuilder().build();
      tokenRepository.getToken.mockResolvedValue(token);

      await cls.run(() => target.get(chainId, token.address, ['TOKEN']));
      await cls.run(() => target.get(chainId, token.address, ['TOKEN']));

      expect(tokenRepository.getToken).toHaveBeenCalledTimes(2);
    });
  });

  describe('get outside of a request', () => {
    it('should look an address up every time', async () => {
      const chainId = faker.string.numeric();
      const token = tokenBuilder().build();
      tokenRepository.getToken.mockResolvedValue(token);

      await target.get(chainId, token.address, ['TOKEN']);
      await target.get(chainId, token.address, ['TOKEN']);

      expect(tokenRepository.getToken).toHaveBeenCalledTimes(2);
    });
  });

  // Note: we do not test the intricacies of `get` here as it is covered above
  describe('getOrDefault', () => {
    it('should return a default if no source is found', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      contractsRepository.getContract.mockRejectedValue(new Error('Not found'));

      const result = await target.getOrDefault(chainId, address, ['CONTRACT']);

      expect(result).toEqual({
        value: address,
        name: null,
        logoUri: null,
      });
      expect(contractsRepository.getContract).toHaveBeenCalledWith({
        chainId,
        contractAddress: address,
      });
    });
  });

  // Note: we do not test the intricacies of `getOrDefault` here as it is covered above
  describe('getCollection', () => {
    it('should return a collection of addresses', async () => {
      const chainId = faker.string.numeric();
      const contract = contractBuilder().build();
      const token = tokenBuilder().build();
      const address = getAddress(faker.finance.ethereumAddress());
      contractsRepository.getContract
        .mockResolvedValueOnce(contract)
        .mockRejectedValueOnce(new Error('Not found'))
        .mockRejectedValueOnce(new Error('Not found'));
      tokenRepository.getToken
        .mockResolvedValueOnce(token)
        .mockRejectedValueOnce(new Error('Not found'));

      const result = await target.getCollection(
        chainId,
        [contract.address, token.address, address],
        ['CONTRACT', 'TOKEN'],
      );

      expect(result).toEqual([
        {
          value: contract.address,
          name: contract.displayName,
          logoUri: contract.logoUrl,
        },
        {
          value: token.address,
          name: token.name,
          logoUri: token.logoUri,
        },
        {
          value: address,
          name: null,
          logoUri: null,
        },
      ]);
      expect(contractsRepository.getContract).toHaveBeenCalledTimes(3);
      expect(tokenRepository.getToken).toHaveBeenCalledTimes(2);
      expect(contractsRepository.getContract).toHaveBeenNthCalledWith(1, {
        chainId,
        contractAddress: contract.address,
      });
      expect(contractsRepository.getContract).toHaveBeenNthCalledWith(2, {
        chainId,
        contractAddress: token.address,
      });
      expect(contractsRepository.getContract).toHaveBeenNthCalledWith(3, {
        chainId,
        contractAddress: address,
      });
      expect(tokenRepository.getToken).toHaveBeenNthCalledWith(1, {
        chainId,
        address: token.address,
      });
      expect(tokenRepository.getToken).toHaveBeenNthCalledWith(2, {
        chainId,
        address,
      });
    });
  });
});
