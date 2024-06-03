import { ContractsRepository } from '@/domain/contracts/contracts.repository';
import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { TokenRepository } from '@/domain/tokens/token.repository';
import { ILoggingService } from '@/logging/logging.interface';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('AddressInfoHelper', () => {
  let target: AddressInfoHelper;

  const contractsRepository = jest.mocked({
    getContract: jest.fn(),
  } as jest.MockedObjectDeep<ContractsRepository>);
  const tokenRepository = jest.mocked({
    getToken: jest.fn(),
  } as jest.MockedObjectDeep<TokenRepository>);
  const loggingService = jest.mocked({
    debug: jest.fn(),
  } as jest.MockedObjectDeep<ILoggingService>);

  beforeEach(() => {
    jest.resetAllMocks();
    target = new AddressInfoHelper(
      contractsRepository,
      tokenRepository,
      loggingService,
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
        logoUri: contract.logoUri,
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
        logoUri: contract.logoUri,
      });
      expect(contractsRepository.getContract).toHaveBeenCalledWith({
        chainId,
        contractAddress: contract.address,
      });
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
          logoUri: contract.logoUri,
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
