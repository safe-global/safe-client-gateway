import { faker } from '@faker-js/faker';
import { ContractsRepository } from '@/domain/contracts/contracts.repository';
import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import { DELEGATE_OPERATION } from '@/domain/safe/entities/operation.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { MULTI_SEND_METHOD_NAME } from '@/routes/transactions/constants';
import { DataDecodedParamHelper } from '@/routes/transactions/mappers/common/data-decoded-param.helper';
import { TransactionDataMapper } from '@/routes/transactions/mappers/common/transaction-data.mapper';

const addressInfoHelper = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<AddressInfoHelper>);

const contractsRepository = jest.mocked({
  getContract: jest.fn(),
} as jest.MockedObjectDeep<ContractsRepository>);

const dataDecodedParamHelper = jest.mocked({
  hasNestedDelegate: jest.fn(),
} as jest.MockedObjectDeep<DataDecodedParamHelper>);

describe('Transaction Data Mapper (Unit)', () => {
  let mapper: TransactionDataMapper;

  beforeEach(() => {
    jest.clearAllMocks();
    mapper = new TransactionDataMapper(
      addressInfoHelper,
      contractsRepository,
      dataDecodedParamHelper,
    );
  });

  describe('Detect trusted delegate calls', () => {
    it('should return null if the operation is not a DELEGATE call', async () => {
      const actual = await mapper.isTrustedDelegateCall(
        faker.string.numeric(),
        0,
        faker.finance.ethereumAddress(),
        dataDecodedBuilder().build(),
      );
      expect(actual).toBeNull();
    });

    it('should return true if data decoded is null', async () => {
      const contract = contractBuilder()
        .with('trustedForDelegateCall', true)
        .build();
      contractsRepository.getContract.mockResolvedValue(contract);

      const actual = await mapper.isTrustedDelegateCall(
        faker.string.numeric(),
        DELEGATE_OPERATION,
        faker.finance.ethereumAddress(),
        null,
      );

      expect(actual).toBe(true);
    });

    it('should mark as non-trusted for delegate call if the contract cannot be retrieved', async () => {
      contractsRepository.getContract.mockRejectedValue({ status: 404 });
      const actual = await mapper.isTrustedDelegateCall(
        faker.string.numeric(),
        1,
        faker.finance.ethereumAddress(),
        dataDecodedBuilder().build(),
      );
      expect(actual).toBe(false);
    });

    it('should mark as non-trusted for delegate call if the contract is not trusted', async () => {
      contractsRepository.getContract.mockResolvedValue(
        contractBuilder().with('trustedForDelegateCall', false).build(),
      );
      const actual = await mapper.isTrustedDelegateCall(
        faker.string.numeric(),
        1,
        faker.finance.ethereumAddress(),
        dataDecodedBuilder().build(),
      );
      expect(actual).toBe(false);
    });

    it('should mark as trusted for delegate call if there is not nested delegate calls', async () => {
      contractsRepository.getContract.mockResolvedValue(
        contractBuilder().with('trustedForDelegateCall', true).build(),
      );
      dataDecodedParamHelper.hasNestedDelegate.mockReturnValue(false);
      const actual = await mapper.isTrustedDelegateCall(
        faker.string.numeric(),
        1,
        faker.finance.ethereumAddress(),
        dataDecodedBuilder().build(),
      );
      expect(actual).toBe(true);
    });

    it('should mark as non-trusted for delegate call if there are nested delegate calls', async () => {
      contractsRepository.getContract.mockResolvedValue(
        contractBuilder().with('trustedForDelegateCall', true).build(),
      );
      dataDecodedParamHelper.hasNestedDelegate.mockReturnValue(true);
      const actual = await mapper.isTrustedDelegateCall(
        faker.string.numeric(),
        1,
        faker.finance.ethereumAddress(),
        dataDecodedBuilder().build(),
      );
      expect(actual).toBe(false);
    });
  });

  describe('Build address info index', () => {
    it('should build an address info index for a non-multiSend with a single value', async () => {
      const dataDecoded = dataDecodedBuilder()
        .with('method', 'changeMasterCopy')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('value', faker.finance.ethereumAddress())
            .with('type', 'address')
            .build(),
        ])
        .build();
      const addressInfo = new AddressInfo(
        faker.finance.ethereumAddress(),
        faker.word.sample(),
        faker.internet.url({ appendSlash: false }),
      );
      addressInfoHelper.get.mockResolvedValueOnce(addressInfo);

      const actual = await mapper.buildAddressInfoIndex(
        faker.string.numeric(),
        dataDecoded,
      );

      expect(actual).toEqual({
        [addressInfo.value]: {
          value: addressInfo.value,
          name: addressInfo.name,
          logoUri: addressInfo.logoUri,
        },
      });
    });

    it('should return an empty address info index if dataDecoded.parameters is null', async () => {
      const dataDecoded = dataDecodedBuilder()
        .with('method', 'changeMasterCopy')
        .with('parameters', null)
        .build();

      const actual = await mapper.buildAddressInfoIndex(
        faker.string.numeric(),
        dataDecoded,
      );

      expect(actual).toEqual({});
      expect(addressInfoHelper.get).toHaveBeenCalledTimes(0);
    });

    it('should return an empty address info index if dataDecoded.parameters contains invalid addresses only', async () => {
      const dataDecoded = dataDecodedBuilder()
        .with('method', 'changeMasterCopy')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('value', faker.string.alphanumeric(42)) // non-hex
            .build(),
          dataDecodedParameterBuilder()
            .with('value', NULL_ADDRESS) // null address (zero hex)
            .build(),
          dataDecodedParameterBuilder()
            .with('value', faker.string.hexadecimal({ length: 5 })) // invalid (short) hex
            .build(),
        ])
        .build();

      const actual = await mapper.buildAddressInfoIndex(
        faker.string.numeric(),
        dataDecoded,
      );

      expect(actual).toEqual({});
      expect(addressInfoHelper.get).toHaveBeenCalledTimes(0);
    });

    it('should build an address info index for a non-multiSend with several values', async () => {
      const addresses = [
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
      ];
      const dataDecoded = dataDecodedBuilder()
        .with('method', 'changeMasterCopy')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('value', faker.finance.ethereumAddress())
            .with('type', 'address')
            .build(),
          dataDecodedParameterBuilder()
            .with('value', faker.finance.ethereumAddress())
            .with('type', 'address')
            .build(),
          dataDecodedParameterBuilder()
            .with('value', faker.finance.ethereumAddress())
            .with('type', 'address')
            .build(),
          dataDecodedParameterBuilder()
            .with('value', faker.finance.ethereumAddress())
            .with('type', 'address')
            .build(),
        ])
        .build();

      const addressInfos = [
        new AddressInfo(
          addresses[0],
          faker.word.sample(),
          faker.internet.url({ appendSlash: false }),
        ),
        new AddressInfo(
          addresses[1],
          faker.word.sample(),
          faker.internet.url({ appendSlash: false }),
        ),
        new AddressInfo(
          addresses[2],
          faker.word.sample(),
          faker.internet.url({ appendSlash: false }),
        ),
      ];
      addressInfoHelper.get.mockResolvedValueOnce(addressInfos[0]);
      addressInfoHelper.get.mockResolvedValueOnce(addressInfos[1]);
      addressInfoHelper.get.mockResolvedValueOnce(addressInfos[1]); // repeated address, should get ignored
      addressInfoHelper.get.mockResolvedValueOnce(addressInfos[2]);

      const actual = await mapper.buildAddressInfoIndex(
        faker.string.numeric(),
        dataDecoded,
      );

      expect(actual).toEqual({
        [addresses[0]]: {
          value: addressInfos[0].value,
          name: addressInfos[0].name,
          logoUri: addressInfos[0].logoUri,
        },
        [addresses[1]]: {
          value: addressInfos[1].value,
          name: addressInfos[1].name,
          logoUri: addressInfos[1].logoUri,
        },
        [addresses[2]]: {
          value: addressInfos[2].value,
          name: addressInfos[2].name,
          logoUri: addressInfos[2].logoUri,
        },
      });
      expect(addressInfoHelper.get).toHaveBeenCalledTimes(4);
    });

    it('should build an address info index for a nested multiSend', async () => {
      const addressInfo = new AddressInfo(
        faker.finance.ethereumAddress(),
        faker.word.sample(),
        faker.internet.url({ appendSlash: false }),
      );
      const dataDecoded = dataDecodedBuilder()
        .with('method', MULTI_SEND_METHOD_NAME)
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', 'transactions')
            .with('value', faker.string.hexadecimal())
            .with('valueDecoded', [
              {
                operation: 0,
                to: faker.finance.ethereumAddress(),
                data: faker.string.hexadecimal(),
                dataDecoded: dataDecodedBuilder()
                  .with('method', 'swap')
                  .with('parameters', [
                    dataDecodedParameterBuilder()
                      .with('name', 'caller')
                      .with('type', 'address')
                      .with('value', addressInfo.value)
                      .build(),
                    dataDecodedParameterBuilder().build(),
                    dataDecodedParameterBuilder().build(),
                  ])
                  .build(),
              },
            ])
            .build(),
        ])
        .build();
      addressInfoHelper.get.mockResolvedValue(addressInfo);

      const actual = await mapper.buildAddressInfoIndex(
        faker.string.numeric(),
        dataDecoded,
      );

      expect(actual).toEqual({
        [addressInfo.value]: {
          value: addressInfo.value,
          name: expect.any(String),
          logoUri: expect.any(String),
        },
      });
      expect(addressInfoHelper.get).toHaveBeenCalledTimes(2);
    });

    it('should build an address info index for a nested multiSend (2)', async () => {
      const contractAddress = faker.finance.ethereumAddress();
      const contractAddressInfo = new AddressInfo(
        contractAddress,
        faker.word.sample(),
        faker.internet.url({ appendSlash: false }),
      );
      const dataDecoded = dataDecodedBuilder()
        .with('method', MULTI_SEND_METHOD_NAME)
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', 'transactions')
            .with('value', faker.string.hexadecimal())
            .with('valueDecoded', [
              {
                operation: 0,
                to: faker.finance.ethereumAddress(),
                data: faker.string.hexadecimal(),
                dataDecoded: dataDecodedBuilder()
                  .with('method', 'swap')
                  .with('parameters', [
                    dataDecodedParameterBuilder()
                      .with('name', 'caller')
                      .with('type', 'address')
                      .with('value', contractAddressInfo.value)
                      .build(),
                    dataDecodedParameterBuilder().build(),
                    dataDecodedParameterBuilder().build(),
                  ])
                  .build(),
              },
              {
                operation: 0,
                to: contractAddress,
                data: faker.string.hexadecimal(),
                dataDecoded: dataDecodedBuilder()
                  .with('method', 'swap')
                  .with('parameters', [
                    dataDecodedParameterBuilder()
                      .with('name', 'caller')
                      .with('type', 'address')
                      .with('value', contractAddressInfo.value)
                      .build(),
                    dataDecodedParameterBuilder().build(),
                    dataDecodedParameterBuilder().build(),
                  ])
                  .build(),
              },
              {
                operation: 0,
                to: contractAddress,
                data: faker.string.hexadecimal(),
                dataDecoded: dataDecodedBuilder()
                  .with('method', 'swap')
                  .with('parameters', [
                    dataDecodedParameterBuilder()
                      .with('name', 'caller')
                      .with('type', 'address')
                      .with('value', contractAddressInfo.value)
                      .build(),
                    dataDecodedParameterBuilder().build(),
                    dataDecodedParameterBuilder().build(),
                  ])
                  .build(),
              },
            ])
            .build(),
        ])
        .build();
      addressInfoHelper.get.mockImplementation((_, address) => {
        return address === contractAddress
          ? Promise.resolve(contractAddressInfo)
          : Promise.resolve(new AddressInfo(address));
      });

      const actual = await mapper.buildAddressInfoIndex(
        faker.string.numeric(),
        dataDecoded,
      );

      expect(actual).toEqual({
        [contractAddressInfo.value]: {
          value: contractAddressInfo.value,
          name: expect.any(String),
          logoUri: expect.any(String),
        },
      });
      expect(addressInfoHelper.get).toHaveBeenCalledTimes(6);
    });
  });
});
