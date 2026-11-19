// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '#/logging/logging.interface';
import type { ContractsRepository } from '#/modules/contracts/domain/contracts.repository';
import { contractBuilder } from '#/modules/data-decoder/domain/v2/entities/__tests__/contract.builder';
import { tokenBuilder } from '#/modules/tokens/domain/__tests__/token.builder';
import type { TokenRepository } from '#/modules/tokens/domain/token.repository';
import { AddressLookups } from '#/routes/common/address-info/address-lookups';

describe('AddressLookups', () => {
  let chainId: string;
  let target: AddressLookups;

  const contractsRepository = vi.mocked({
    getContract: vi.fn(),
  } as MockedObject<ContractsRepository>);
  const tokenRepository = vi.mocked({
    getToken: vi.fn(),
  } as MockedObject<TokenRepository>);
  const loggingService = vi.mocked({
    debug: vi.fn(),
  } as MockedObject<ILoggingService>);

  beforeEach(() => {
    vi.resetAllMocks();
    chainId = faker.string.numeric();
    target = new AddressLookups(
      chainId,
      tokenRepository,
      contractsRepository,
      loggingService,
    );
  });

  describe('getToken', () => {
    it('should look a token up once', async () => {
      const token = tokenBuilder().build();
      tokenRepository.getToken.mockResolvedValue(token);

      const results = [
        await target.getToken(token.address),
        await target.getToken(token.address),
      ];

      expect(results).toEqual([token, token]);
      expect(tokenRepository.getToken).toHaveBeenCalledTimes(1);
      expect(tokenRepository.getToken).toHaveBeenCalledWith({
        chainId,
        address: token.address,
      });
    });

    it('should share a lookup that is still pending', async () => {
      const token = tokenBuilder().build();
      tokenRepository.getToken.mockResolvedValue(token);

      await Promise.all([
        target.getToken(token.address),
        target.getToken(token.address),
      ]);

      expect(tokenRepository.getToken).toHaveBeenCalledTimes(1);
    });

    it('should not look a token up again after the lookup failed', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const error = new Error('Not found');
      tokenRepository.getToken.mockRejectedValue(error);

      await expect(target.getToken(address)).rejects.toBe(error);
      await expect(target.getToken(address)).rejects.toBe(error);

      expect(tokenRepository.getToken).toHaveBeenCalledTimes(1);
    });

    it('should look each address up', async () => {
      const [token, otherToken] = [
        tokenBuilder().build(),
        tokenBuilder().build(),
      ];
      tokenRepository.getToken.mockImplementation(({ address }) =>
        Promise.resolve(address === token.address ? token : otherToken),
      );

      const results = await Promise.all([
        target.getToken(token.address),
        target.getToken(otherToken.address),
      ]);

      expect(results).toEqual([token, otherToken]);
      expect(tokenRepository.getToken).toHaveBeenCalledTimes(2);
    });
  });

  describe('get', () => {
    it('should look a contract up once', async () => {
      const contract = contractBuilder().build();
      contractsRepository.getContract.mockResolvedValue(contract);

      const results = await Promise.all([
        target.get(contract.address, ['CONTRACT']),
        target.get(contract.address, ['CONTRACT']),
      ]);

      const expected = {
        value: contract.address,
        name: contract.displayName,
        logoUri: contract.logoUrl,
      };
      expect(results).toEqual([expected, expected]);
      expect(results[0]).not.toBe(results[1]);
      expect(contractsRepository.getContract).toHaveBeenCalledTimes(1);
      expect(contractsRepository.getContract).toHaveBeenCalledWith({
        chainId,
        contractAddress: contract.address,
      });
    });

    it('should share the lookup of each source between lists of sources', async () => {
      const contract = contractBuilder().build();
      tokenRepository.getToken.mockRejectedValue(new Error('Not found'));
      contractsRepository.getContract.mockResolvedValue(contract);

      const results = await Promise.all([
        target.get(contract.address, ['TOKEN', 'CONTRACT']),
        target.get(contract.address, ['CONTRACT']),
        target.get(contract.address, ['CONTRACT', 'TOKEN']),
      ]);

      const expected = {
        value: contract.address,
        name: contract.displayName,
        logoUri: contract.logoUrl,
      };
      expect(results).toEqual([expected, expected, expected]);
      expect(tokenRepository.getToken).toHaveBeenCalledTimes(1);
      expect(contractsRepository.getContract).toHaveBeenCalledTimes(1);
    });

    it('should share the token lookup with getToken', async () => {
      const token = tokenBuilder().build();
      tokenRepository.getToken.mockResolvedValue(token);

      const [addressInfo, result] = await Promise.all([
        target.get(token.address, ['TOKEN']),
        target.getToken(token.address),
      ]);

      expect(addressInfo).toEqual({
        value: token.address,
        name: token.name,
        logoUri: token.logoUri,
      });
      expect(result).toBe(token);
      expect(tokenRepository.getToken).toHaveBeenCalledTimes(1);
    });

    it('should return a separate AddressInfo to each caller', async () => {
      const token = tokenBuilder().build();
      tokenRepository.getToken.mockResolvedValue(token);

      const [first, second] = await Promise.all([
        target.get(token.address, ['TOKEN']),
        target.get(token.address, ['TOKEN']),
      ]);

      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });

    it('should reject if no source knows the address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      tokenRepository.getToken.mockRejectedValue(new Error('Not found'));
      contractsRepository.getContract.mockRejectedValue(new Error('Not found'));

      await expect(target.get(address, ['TOKEN', 'CONTRACT'])).rejects.toBe(
        `Could not get address info from provided sources=TOKEN,CONTRACT for ${address}`,
      );
    });
  });

  describe('getOrDefault', () => {
    it('should not look an address up again after the lookups failed', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      tokenRepository.getToken.mockRejectedValue(new Error('Not found'));
      contractsRepository.getContract.mockRejectedValue(new Error('Not found'));

      const results = await Promise.all([
        target.getOrDefault(address, ['TOKEN', 'CONTRACT']),
        target.getOrDefault(address, ['TOKEN', 'CONTRACT']),
      ]);

      expect(results).toEqual([
        { value: address, name: null, logoUri: null },
        { value: address, name: null, logoUri: null },
      ]);
      expect(tokenRepository.getToken).toHaveBeenCalledTimes(1);
      expect(contractsRepository.getContract).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCollection', () => {
    it('should look each distinct address up once', async () => {
      const token = tokenBuilder().build();
      const address = getAddress(faker.finance.ethereumAddress());
      tokenRepository.getToken.mockImplementation((args) =>
        args.address === token.address
          ? Promise.resolve(token)
          : Promise.reject(new Error('Not found')),
      );

      const results = await target.getCollection(
        [token.address, address, token.address],
        ['TOKEN'],
      );

      const tokenInfo = {
        value: token.address,
        name: token.name,
        logoUri: token.logoUri,
      };
      expect(results).toEqual([
        tokenInfo,
        { value: address, name: null, logoUri: null },
        tokenInfo,
      ]);
      expect(tokenRepository.getToken).toHaveBeenCalledTimes(2);
    });
  });

  it('should look an address up again in other lookups', async () => {
    const token = tokenBuilder().build();
    tokenRepository.getToken.mockResolvedValue(token);
    const otherLookups = new AddressLookups(
      chainId,
      tokenRepository,
      contractsRepository,
      loggingService,
    );

    await target.getToken(token.address);
    await otherLookups.getToken(token.address);

    expect(tokenRepository.getToken).toHaveBeenCalledTimes(2);
  });
});
