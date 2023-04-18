import { faker } from '@faker-js/faker';
import { ContractsRepository } from '../../../../domain/contracts/contracts.repository';
import { contractBuilder } from '../../../../domain/contracts/entities/__tests__/contract.builder';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '../../../../domain/data-decoder/entities/__tests__/data-decoded.builder';
import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import { NULL_ADDRESS } from '../../../common/constants';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import { MULTI_SEND_METHOD_NAME } from '../../constants';
import { DataDecodedParamHelper } from './data-decoded-param.helper';
import { TransactionDataMapper } from './transaction-data.mapper';

const addressInfoHelper = jest.mocked({
  getOrDefault: jest.fn(),
} as unknown as AddressInfoHelper);

const contractsRepository = jest.mocked({
  getContract: jest.fn(),
} as unknown as ContractsRepository);

const dataDecodedParamHelper = jest.mocked({
  hasNestedDelegate: jest.fn(),
} as unknown as DataDecodedParamHelper);

describe('Transaction Data Mapper (Unit)', () => {
  let mapper: TransactionDataMapper;

  beforeEach(() => {
    jest.resetAllMocks();
    mapper = new TransactionDataMapper(
      addressInfoHelper,
      contractsRepository,
      dataDecodedParamHelper,
    );
  });

  describe('Detect trusted delegate calls', () => {
    it('should return null if the operation is not a DELEGATE call', async () => {
      const actual = await mapper.isTrustedDelegateCall(
        faker.random.numeric(),
        0,
        faker.finance.ethereumAddress(),
        dataDecodedBuilder().build(),
      );
      expect(actual).toBeNull();
    });

    it('should mark as non-trusted for delegate call if the contract cannot be retrieved', async () => {
      contractsRepository.getContract.mockRejectedValue({ status: 404 });
      const actual = await mapper.isTrustedDelegateCall(
        faker.random.numeric(),
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
        faker.random.numeric(),
        1,
        faker.finance.ethereumAddress(),
        dataDecodedBuilder().build(),
      );
      expect(actual).toBe(false);
    });

    it('should mark as non-trusted for delegate call if there is not nested delegate calls', async () => {
      contractsRepository.getContract.mockResolvedValue(
        contractBuilder().with('trustedForDelegateCall', true).build(),
      );
      dataDecodedParamHelper.hasNestedDelegate.mockReturnValue(false);
      const actual = await mapper.isTrustedDelegateCall(
        faker.random.numeric(),
        1,
        faker.finance.ethereumAddress(),
        dataDecodedBuilder().build(),
      );
      expect(actual).toBe(false);
    });

    it('should mark as trusted for delegate call', async () => {
      contractsRepository.getContract.mockResolvedValue(
        contractBuilder().with('trustedForDelegateCall', true).build(),
      );
      dataDecodedParamHelper.hasNestedDelegate.mockReturnValue(true);
      const actual = await mapper.isTrustedDelegateCall(
        faker.random.numeric(),
        1,
        faker.finance.ethereumAddress(),
        dataDecodedBuilder().build(),
      );
      expect(actual).toBe(true);
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
        faker.random.word(),
        faker.internet.url(),
      );
      addressInfoHelper.getOrDefault.mockResolvedValueOnce(addressInfo);

      const actual = await mapper.buildAddressInfoIndex(
        faker.random.numeric(),
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
        faker.random.numeric(),
        dataDecoded,
      );

      expect(actual).toEqual({});
      expect(addressInfoHelper.getOrDefault).toHaveBeenCalledTimes(0);
    });

    it('should return an empty address info index if dataDecoded.parameters contains invalid addresses only', async () => {
      const dataDecoded = dataDecodedBuilder()
        .with('method', 'changeMasterCopy')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('value', faker.random.alphaNumeric(42)) // non-hex
            .build(),
          dataDecodedParameterBuilder()
            .with('value', NULL_ADDRESS) // null address (zero hex)
            .build(),
          dataDecodedParameterBuilder()
            .with('value', faker.datatype.hexadecimal(5)) // invalid (short) hex
            .build(),
        ])
        .build();

      const actual = await mapper.buildAddressInfoIndex(
        faker.random.numeric(),
        dataDecoded,
      );

      expect(actual).toEqual({});
      expect(addressInfoHelper.getOrDefault).toHaveBeenCalledTimes(0);
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
          faker.random.word(),
          faker.internet.url(),
        ),
        new AddressInfo(
          addresses[1],
          faker.random.word(),
          faker.internet.url(),
        ),
        new AddressInfo(
          addresses[2],
          faker.random.word(),
          faker.internet.url(),
        ),
      ];
      addressInfoHelper.getOrDefault.mockResolvedValueOnce(addressInfos[0]);
      addressInfoHelper.getOrDefault.mockResolvedValueOnce(addressInfos[1]);
      addressInfoHelper.getOrDefault.mockResolvedValueOnce(addressInfos[1]); // repeated address, should get ignored
      addressInfoHelper.getOrDefault.mockResolvedValueOnce(addressInfos[2]);

      const actual = await mapper.buildAddressInfoIndex(
        faker.random.numeric(),
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
      expect(addressInfoHelper.getOrDefault).toHaveBeenCalledTimes(4);
    });

    it('should build an address info index for a multiSend with single level of nesting', async () => {
      const addressInfo = new AddressInfo(
        faker.finance.ethereumAddress(),
        faker.random.word(),
        faker.internet.url(),
      );
      const dataDecoded = dataDecodedBuilder()
        .with('method', MULTI_SEND_METHOD_NAME)
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', 'transactions')
            .with('value', faker.datatype.hexadecimal())
            .with('valueDecoded', [
              {
                operation: 0,
                to: faker.finance.ethereumAddress(),
                data: faker.datatype.hexadecimal(),
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
      addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);

      const actual = await mapper.buildAddressInfoIndex(
        faker.random.numeric(),
        dataDecoded,
      );

      expect(actual).toEqual({
        [addressInfo.value]: {
          value: addressInfo.value,
          name: expect.any(String),
          logoUri: expect.any(String),
        },
      });
      expect(addressInfoHelper.getOrDefault).toHaveBeenCalledTimes(1);
    });

    it('should build an address info index for a multiSend with two levels of nesting', async () => {
      const resolvedAddresses = [
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
      ];
      const dataDecoded = dataDecodedBuilder()
        .with('method', MULTI_SEND_METHOD_NAME)
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', 'transactions')
            .with('value', faker.datatype.hexadecimal())
            .with('valueDecoded', [
              {
                operation: 0,
                to: faker.finance.ethereumAddress(),
                data: faker.datatype.hexadecimal(),
                dataDecoded: dataDecodedBuilder()
                  .with('method', 'transfer')
                  .with('parameters', [
                    dataDecodedParameterBuilder()
                      .with('name', 'to')
                      .with('type', 'address')
                      .with('value', resolvedAddresses[0])
                      .build(),
                    dataDecodedParameterBuilder().build(),
                    dataDecodedParameterBuilder().build(),
                  ])
                  .build(),
              },
              {
                operation: 0,
                to: faker.finance.ethereumAddress(),
                data: faker.datatype.hexadecimal(),
                dataDecoded: dataDecodedBuilder()
                  .with('method', 'multiSend')
                  .with('parameters', [
                    dataDecodedParameterBuilder()
                      .with('name', 'transactions')
                      .with('type', 'bytes')
                      .with('value', faker.datatype.hexadecimal())
                      .with('valueDecoded', [
                        {
                          operation: 0,
                          to: faker.finance.ethereumAddress(),
                          data: faker.datatype.hexadecimal(),
                          dataDecoded: dataDecodedBuilder()
                            .with('parameters', [
                              dataDecodedParameterBuilder()
                                .with('name', 'to')
                                .with('type', 'address')
                                .with('value', resolvedAddresses[1])
                                .build(),
                            ])
                            .build(),
                        },
                      ])
                      .build(),
                  ])
                  .build(),
              },
            ])
            .build(),
        ])
        .build();
      addressInfoHelper.getOrDefault.mockImplementation((chainId, addr) => {
        return Promise.resolve(
          new AddressInfo(
            resolvedAddresses.includes(addr)
              ? addr
              : faker.finance.ethereumAddress(),
            faker.random.word(),
            faker.internet.url(),
          ),
        );
      });

      const actual = await mapper.buildAddressInfoIndex(
        faker.random.numeric(),
        dataDecoded,
      );

      expect(actual).toEqual({
        [resolvedAddresses[0]]: {
          value: resolvedAddresses[0],
          name: expect.any(String),
          logoUri: expect.any(String),
        },
        [resolvedAddresses[1]]: {
          value: resolvedAddresses[1],
          name: expect.any(String),
          logoUri: expect.any(String),
        },
      });
      expect(addressInfoHelper.getOrDefault).toHaveBeenCalledTimes(2);
    });

    it('should build an address info index for a multiSend with three levels of nesting', async () => {
      const resolvedAddresses = [
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
      ];
      const dataDecoded = dataDecodedBuilder()
        .with('method', MULTI_SEND_METHOD_NAME)
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', 'transactions')
            .with('value', faker.datatype.hexadecimal())
            .with('valueDecoded', [
              {
                operation: 0,
                to: faker.finance.ethereumAddress(),
                data: faker.datatype.hexadecimal(),
                dataDecoded: dataDecodedBuilder()
                  .with('method', 'transfer')
                  .with('parameters', [
                    dataDecodedParameterBuilder()
                      .with('name', 'to')
                      .with('type', 'address')
                      .with('value', resolvedAddresses[0])
                      .build(),
                    dataDecodedParameterBuilder().build(),
                    dataDecodedParameterBuilder().build(),
                  ])
                  .build(),
              },
              {
                operation: 0,
                to: faker.finance.ethereumAddress(),
                data: faker.datatype.hexadecimal(),
                dataDecoded: dataDecodedBuilder()
                  .with('method', 'multiSend')
                  .with('parameters', [
                    dataDecodedParameterBuilder()
                      .with('name', 'transactions')
                      .with('type', 'bytes')
                      .with('value', faker.datatype.hexadecimal())
                      .with('valueDecoded', [
                        {
                          operation: 0,
                          to: faker.finance.ethereumAddress(),
                          data: faker.datatype.hexadecimal(),
                          dataDecoded: dataDecodedBuilder()
                            .with('method', 'multiSend')
                            .with('parameters', [
                              dataDecodedParameterBuilder()
                                .with('name', 'transactions')
                                .with('valueDecoded', [
                                  {
                                    operation: 0,
                                    dataDecoded: dataDecodedBuilder()
                                      .with('parameters', [
                                        dataDecodedParameterBuilder()
                                          .with('name', 'to')
                                          .with('type', 'address')
                                          .with('value', resolvedAddresses[1])
                                          .build(),
                                        dataDecodedParameterBuilder()
                                          .with('name', 'to')
                                          .with('type', 'address')
                                          .with('value', resolvedAddresses[1]) // repeated, should be ignored
                                          .build(),
                                        dataDecodedParameterBuilder()
                                          .with('name', 'from')
                                          .with('type', 'address')
                                          .with('value', resolvedAddresses[2])
                                          .build(),
                                      ])
                                      .build(),
                                  },
                                ])
                                .build(),
                            ])
                            .build(),
                        },
                        {
                          operation: 0,
                          dataDecoded: dataDecodedBuilder().build(),
                        },
                      ])
                      .build(),
                  ])
                  .build(),
              },
            ])
            .build(),
        ])
        .build();
      addressInfoHelper.getOrDefault.mockImplementation((chainId, addr) => {
        return Promise.resolve(
          new AddressInfo(
            resolvedAddresses.includes(addr)
              ? addr
              : faker.finance.ethereumAddress(),
            faker.random.word(),
            faker.internet.url(),
          ),
        );
      });

      const actual = await mapper.buildAddressInfoIndex(
        faker.random.numeric(),
        dataDecoded,
      );

      expect(actual).toEqual({
        [resolvedAddresses[0]]: {
          value: resolvedAddresses[0],
          name: expect.any(String),
          logoUri: expect.any(String),
        },
        [resolvedAddresses[1]]: {
          value: resolvedAddresses[1],
          name: expect.any(String),
          logoUri: expect.any(String),
        },
        [resolvedAddresses[2]]: {
          value: resolvedAddresses[2],
          name: expect.any(String),
          logoUri: expect.any(String),
        },
      });
      expect(addressInfoHelper.getOrDefault).toHaveBeenCalledTimes(4);
    });
  });
});
