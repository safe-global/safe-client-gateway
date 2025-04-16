import { faker } from '@faker-js/faker';
import type { ContractsRepository } from '@/domain/contracts/contracts.repository';
import {
  baseDataDecodedBuilder,
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
  multisendBuilder,
} from '@/domain/data-decoder/v2/entities/__tests__/data-decoded.builder';
import { Operation } from '@/domain/safe/entities/operation.entity';
import type { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { MULTI_SEND_METHOD_NAME } from '@/routes/transactions/constants';
import type { DataDecodedParamHelper } from '@/routes/transactions/mappers/common/data-decoded-param.helper';
import { TransactionDataMapper } from '@/routes/transactions/mappers/common/transaction-data.mapper';
import { getAddress } from 'viem';
import type { MultisigTransactionInfoMapper } from '@/routes/transactions/mappers/common/transaction-info.mapper';
import type { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import type { TokenRepository } from '@/domain/tokens/token.repository';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import {
  erc20TransferEncoder,
  erc20TransferFromEncoder,
} from '@/domain/relay/contracts/__tests__/encoders/erc20-encoder.builder';
import { erc20TokenBuilder } from '@/domain/tokens/__tests__/token.builder';

const addressInfoHelper = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<AddressInfoHelper>);

const contractsRepository = jest.mocked({
  isTrustedForDelegateCall: jest.fn(),
} as jest.MockedObjectDeep<ContractsRepository>);

const dataDecodedParamHelper = jest.mocked({
  hasNestedDelegate: jest.fn(),
} as jest.MockedObjectDeep<DataDecodedParamHelper>);

const transactionInfoMapper = jest.mocked({
  isValidTokenTransfer: jest.fn(),
} as jest.MockedObjectDeep<MultisigTransactionInfoMapper>);

const chainsRepository = jest.mocked({
  getChain: jest.fn(),
} as jest.MockedObjectDeep<IChainsRepository>);

const tokenRepository = jest.mocked({
  getToken: jest.fn(),
} as jest.MockedObjectDeep<TokenRepository>);

const configurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

describe('Transaction Data Mapper (Unit)', () => {
  let mapper: TransactionDataMapper;
  const maxTokenInfoIndexSize = 2;

  beforeEach(() => {
    jest.resetAllMocks();

    configurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'mappings.transactionData.maxTokenInfoIndexSize') {
        return maxTokenInfoIndexSize;
      }
      throw new Error(`Unknown config key: ${key}`);
    });

    mapper = new TransactionDataMapper(
      addressInfoHelper,
      contractsRepository,
      dataDecodedParamHelper,
      transactionInfoMapper,
      chainsRepository,
      tokenRepository,
      configurationService,
    );
  });

  describe('Detect trusted delegate calls', () => {
    it('should return null if the operation is not a DELEGATE call', async () => {
      const actual = await mapper.isTrustedDelegateCall(
        faker.string.numeric(),
        0,
        getAddress(faker.finance.ethereumAddress()),
        dataDecodedBuilder().build(),
      );
      expect(actual).toBeNull();
    });

    it('should return true if data decoded is null', async () => {
      contractsRepository.isTrustedForDelegateCall.mockResolvedValue(true);

      const actual = await mapper.isTrustedDelegateCall(
        faker.string.numeric(),
        Operation.DELEGATE,
        getAddress(faker.finance.ethereumAddress()),
        null,
      );

      expect(actual).toBe(true);
    });

    it('should mark as non-trusted for delegate call if an error happens', async () => {
      contractsRepository.isTrustedForDelegateCall.mockRejectedValue({
        status: 502,
      });
      const actual = await mapper.isTrustedDelegateCall(
        faker.string.numeric(),
        1,
        getAddress(faker.finance.ethereumAddress()),
        dataDecodedBuilder().build(),
      );
      expect(actual).toBe(false);
    });

    it('should mark as non-trusted for delegate call if the contract is not trusted', async () => {
      contractsRepository.isTrustedForDelegateCall.mockResolvedValue(false);
      const actual = await mapper.isTrustedDelegateCall(
        faker.string.numeric(),
        1,
        getAddress(faker.finance.ethereumAddress()),
        dataDecodedBuilder().build(),
      );
      expect(actual).toBe(false);
    });

    it('should mark as trusted for delegate call if there is not nested delegate calls', async () => {
      contractsRepository.isTrustedForDelegateCall.mockResolvedValue(true);
      dataDecodedParamHelper.hasNestedDelegate.mockReturnValue(false);
      const actual = await mapper.isTrustedDelegateCall(
        faker.string.numeric(),
        1,
        getAddress(faker.finance.ethereumAddress()),
        dataDecodedBuilder().build(),
      );
      expect(actual).toBe(true);
    });

    it('should mark as non-trusted for delegate call if there are nested delegate calls', async () => {
      contractsRepository.isTrustedForDelegateCall.mockResolvedValue(true);
      dataDecodedParamHelper.hasNestedDelegate.mockReturnValue(true);
      const actual = await mapper.isTrustedDelegateCall(
        faker.string.numeric(),
        1,
        getAddress(faker.finance.ethereumAddress()),
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
                to: getAddress(faker.finance.ethereumAddress()),
                value: faker.string.numeric(),
                data: faker.string.hexadecimal() as `0x${string}`,
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
      const contractAddress = getAddress(faker.finance.ethereumAddress());
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
                to: getAddress(faker.finance.ethereumAddress()),
                data: faker.string.hexadecimal() as `0x${string}`,
                value: faker.string.numeric(),
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
                value: faker.string.numeric(),
                data: faker.string.hexadecimal() as `0x${string}`,
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
                data: faker.string.hexadecimal() as `0x${string}`,
                value: faker.string.numeric(),
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

  describe('Build TokenInfo index', () => {
    it('should return an empty TokenInfo index if there are no dataDecoded parameters', async () => {
      const chainId = faker.number.int({ min: 1 }).toString();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const dataDecoded = baseDataDecodedBuilder()
        .with('parameters', null)
        .build();

      const actual = await mapper.buildTokenInfoIndex({
        chainId,
        safeAddress,
        dataDecoded,
      });

      expect(actual).toStrictEqual({});
    });

    it('should return an empty TokenInfo index if the method is not multiSend', async () => {
      const chainId = faker.number.int({ min: 1 }).toString();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const dataDecoded = baseDataDecodedBuilder()
        .with('method', faker.word.noun())
        .build();

      const actual = await mapper.buildTokenInfoIndex({
        chainId,
        safeAddress,
        dataDecoded,
      });

      expect(actual).toStrictEqual({});
    });

    it('should return an empty TokenInfo index if the multiSend parameter name is not transactions', async () => {
      const chainId = faker.number.int({ min: 1 }).toString();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const dataDecoded = baseDataDecodedBuilder()
        .with('method', 'multiSend')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', faker.word.noun())
            .with('type', 'bytes')
            .with('valueDecoded', [multisendBuilder().build()])
            .build(),
        ])
        .build();

      const actual = await mapper.buildTokenInfoIndex({
        chainId,
        safeAddress,
        dataDecoded,
      });

      expect(actual).toStrictEqual({});
    });

    it('should return an empty TokenInfo index if the multiSend parameter type is not bytes', async () => {
      const chainId = faker.number.int({ min: 1 }).toString();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const dataDecoded = baseDataDecodedBuilder()
        .with('method', 'multiSend')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', 'transactions')
            .with('type', faker.word.noun())
            .with('valueDecoded', [multisendBuilder().build()])
            .build(),
        ])
        .build();

      const actual = await mapper.buildTokenInfoIndex({
        chainId,
        safeAddress,
        dataDecoded,
      });

      expect(actual).toStrictEqual({});
    });

    it('should build a deduped TokenInfo index for a multiSend transaction with multiple native transfers', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const dataDecoded = baseDataDecodedBuilder()
        .with('method', 'multiSend')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', 'transactions')
            .with('type', 'bytes')
            .with(
              'valueDecoded',
              faker.helpers.multiple(
                () =>
                  multisendBuilder()
                    // Native transfer
                    .with('value', faker.number.int({ min: 1 }).toString())
                    .build(),
                {
                  count: {
                    // Should be deduped
                    min: 2,
                    max: 5,
                  },
                },
              ),
            )
            .build(),
        ])
        .build();
      chainsRepository.getChain.mockResolvedValue(chain);

      const actual = await mapper.buildTokenInfoIndex({
        chainId: chain.chainId,
        safeAddress,
        dataDecoded,
      });

      expect(actual).toStrictEqual({
        [NULL_ADDRESS]: {
          address: NULL_ADDRESS,
          decimals: chain.nativeCurrency.decimals,
          logoUri: chain.nativeCurrency.logoUri,
          name: chain.nativeCurrency.name,
          symbol: chain.nativeCurrency.symbol,
          trusted: true,
          type: 'NATIVE_TOKEN',
        },
      });
    });

    it('should build a deduped TokenInfo index for a multiSend transaction with multiple token transfers', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const erc20Token = erc20TokenBuilder().build();
      const firstRecipient = getAddress(faker.finance.ethereumAddress());
      const firstValue = faker.number.int({ min: 1 }).toString();
      const secondRecipient = getAddress(faker.finance.ethereumAddress());
      const secondValue = faker.number.int({ min: 1 }).toString();
      const thirdRecipient = getAddress(faker.finance.ethereumAddress());
      const thirdValue = faker.number.int({ min: 1 }).toString();
      const dataDecoded = baseDataDecodedBuilder()
        .with('method', 'multiSend')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', 'transactions')
            .with('type', 'bytes')
            .with('valueDecoded', [
              multisendBuilder()
                .with('value', '0')
                .with('to', erc20Token.address)
                .with(
                  'data',
                  erc20TransferEncoder()
                    .with('to', firstRecipient)
                    .with('value', BigInt(firstValue))
                    .encode(),
                )
                .with(
                  'dataDecoded',
                  baseDataDecodedBuilder()
                    .with('method', 'transfer')
                    .with('parameters', [
                      dataDecodedParameterBuilder()
                        .with('name', 'to')
                        .with('type', 'address')
                        .with('value', firstRecipient)
                        .build(),
                      dataDecodedParameterBuilder()
                        .with('name', 'value')
                        .with('type', 'uint256')
                        .with('value', firstValue)
                        .build(),
                    ])
                    .build(),
                )
                .build(),
              multisendBuilder()
                .with('value', '0')
                // Same address, should be deduped
                .with('to', erc20Token.address)
                .with(
                  'data',
                  erc20TransferEncoder()
                    .with('to', secondRecipient)
                    .with('value', BigInt(secondValue))
                    .encode(),
                )
                .with(
                  'dataDecoded',
                  baseDataDecodedBuilder()
                    .with('method', 'transfer')
                    .with('parameters', [
                      dataDecodedParameterBuilder()
                        .with('name', 'to')
                        .with('type', 'address')
                        .with('value', secondRecipient)
                        .build(),
                      dataDecodedParameterBuilder()
                        .with('name', 'value')
                        .with('type', 'uint256')
                        .with('value', secondValue)
                        .build(),
                    ])
                    .build(),
                )
                .build(),
              multisendBuilder()
                .with('value', '0')
                // Same address, should be deduped
                .with('to', erc20Token.address)
                .with(
                  'data',
                  erc20TransferFromEncoder()
                    .with('sender', safeAddress)
                    .with('recipient', thirdRecipient)
                    .with('amount', BigInt(thirdValue))
                    .encode(),
                )
                .with(
                  'dataDecoded',
                  baseDataDecodedBuilder()
                    .with('method', 'transfer')
                    .with('parameters', [
                      dataDecodedParameterBuilder()
                        .with('name', 'sender')
                        .with('type', 'address')
                        .with('value', safeAddress)
                        .build(),
                      dataDecodedParameterBuilder()
                        .with('name', 'recipient')
                        .with('type', 'address')
                        .with('value', thirdRecipient)
                        .build(),
                      dataDecodedParameterBuilder()
                        .with('name', 'amount')
                        .with('type', 'uint256')
                        .with('value', thirdValue)
                        .build(),
                    ])
                    .build(),
                )
                .build(),
            ])
            .build(),
        ])
        .build();
      chainsRepository.getChain.mockResolvedValue(chain);
      transactionInfoMapper.isValidTokenTransfer.mockReturnValue(true);
      tokenRepository.getToken.mockImplementation(({ address }) => {
        if (address === erc20Token.address) {
          return Promise.resolve(erc20Token);
        }
        throw new Error('Token not found');
      });

      const actual = await mapper.buildTokenInfoIndex({
        chainId: chain.chainId,
        safeAddress,
        dataDecoded,
      });

      expect(actual).toStrictEqual({
        [erc20Token.address]: {
          address: erc20Token.address,
          decimals: erc20Token.decimals,
          logoUri: erc20Token.logoUri,
          name: erc20Token.name,
          symbol: erc20Token.symbol,
          trusted: erc20Token.trusted,
          type: 'ERC20',
        },
      });
    });

    it('should build a deduped TokenInfo index for a multiSend transaction with multiple native/token transfers', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const erc20Token = erc20TokenBuilder().build();
      const firstErc20Recipient = getAddress(faker.finance.ethereumAddress());
      const firstErc20Value = faker.number.int({ min: 1 }).toString();
      const secondErc20Recipient = getAddress(faker.finance.ethereumAddress());
      const secondErc20Value = faker.number.int({ min: 1 }).toString();
      const thirdErc20Recipient = getAddress(faker.finance.ethereumAddress());
      const thirdErc20Value = faker.number.int({ min: 1 }).toString();
      const dataDecoded = baseDataDecodedBuilder()
        .with('method', 'multiSend')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', 'transactions')
            .with('type', 'bytes')
            .with('valueDecoded', [
              ...faker.helpers.multiple(
                () =>
                  multisendBuilder()
                    // Native transfer
                    .with('value', faker.number.int({ min: 1 }).toString())
                    .build(),
                {
                  count: {
                    // Should be deduped
                    min: 2,
                    max: 5,
                  },
                },
              ),
              multisendBuilder()
                .with('value', '0')
                .with('to', erc20Token.address)
                .with(
                  'data',
                  erc20TransferEncoder()
                    .with('to', firstErc20Recipient)
                    .with('value', BigInt(firstErc20Value))
                    .encode(),
                )
                .with(
                  'dataDecoded',
                  baseDataDecodedBuilder()
                    .with('method', 'transfer')
                    .with('parameters', [
                      dataDecodedParameterBuilder()
                        .with('name', 'to')
                        .with('type', 'address')
                        .with('value', firstErc20Recipient)
                        .build(),
                      dataDecodedParameterBuilder()
                        .with('name', 'value')
                        .with('type', 'uint256')
                        .with('value', firstErc20Value)
                        .build(),
                    ])
                    .build(),
                )
                .build(),
              multisendBuilder()
                .with('value', '0')
                // Same address, should be deduped
                .with('to', erc20Token.address)
                .with(
                  'data',
                  erc20TransferEncoder()
                    .with('to', secondErc20Recipient)
                    .with('value', BigInt(secondErc20Value))
                    .encode(),
                )
                .with(
                  'dataDecoded',
                  baseDataDecodedBuilder()
                    .with('method', 'transfer')
                    .with('parameters', [
                      dataDecodedParameterBuilder()
                        .with('name', 'to')
                        .with('type', 'address')
                        .with('value', secondErc20Recipient)
                        .build(),
                      dataDecodedParameterBuilder()
                        .with('name', 'value')
                        .with('type', 'uint256')
                        .with('value', secondErc20Value)
                        .build(),
                    ])
                    .build(),
                )
                .build(),
              multisendBuilder()
                .with('value', '0')
                // Same address, should be deduped
                .with('to', erc20Token.address)
                .with(
                  'data',
                  erc20TransferFromEncoder()
                    .with('sender', safeAddress)
                    .with('recipient', thirdErc20Recipient)
                    .with('amount', BigInt(thirdErc20Value))
                    .encode(),
                )
                .with(
                  'dataDecoded',
                  baseDataDecodedBuilder()
                    .with('method', 'transfer')
                    .with('parameters', [
                      dataDecodedParameterBuilder()
                        .with('name', 'sender')
                        .with('type', 'address')
                        .with('value', safeAddress)
                        .build(),
                      dataDecodedParameterBuilder()
                        .with('name', 'recipient')
                        .with('type', 'address')
                        .with('value', thirdErc20Recipient)
                        .build(),
                      dataDecodedParameterBuilder()
                        .with('name', 'amount')
                        .with('type', 'uint256')
                        .with('value', thirdErc20Value)
                        .build(),
                    ])
                    .build(),
                )
                .build(),
            ])
            .build(),
        ])
        .build();
      chainsRepository.getChain.mockResolvedValue(chain);
      transactionInfoMapper.isValidTokenTransfer.mockReturnValue(true);
      tokenRepository.getToken.mockImplementation(({ address }) => {
        if (address === erc20Token.address) {
          return Promise.resolve(erc20Token);
        }
        throw new Error('Token not found');
      });

      const actual = await mapper.buildTokenInfoIndex({
        chainId: chain.chainId,
        safeAddress,
        dataDecoded,
      });

      expect(actual).toStrictEqual({
        [NULL_ADDRESS]: {
          address: NULL_ADDRESS,
          decimals: chain.nativeCurrency.decimals,
          logoUri: chain.nativeCurrency.logoUri,
          name: chain.nativeCurrency.name,
          symbol: chain.nativeCurrency.symbol,
          trusted: true,
          type: 'NATIVE_TOKEN',
        },
        [erc20Token.address]: {
          address: erc20Token.address,
          decimals: erc20Token.decimals,
          logoUri: erc20Token.logoUri,
          name: erc20Token.name,
          symbol: erc20Token.symbol,
          trusted: erc20Token.trusted,
          type: 'ERC20',
        },
      });
    });

    it('should limit the size of the TokenInfo index', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const firstErc20Token = erc20TokenBuilder().build();
      const firstErc20Recipient = getAddress(faker.finance.ethereumAddress());
      const firstErc20Value = faker.number.int({ min: 1 }).toString();
      const secondErc20Token = erc20TokenBuilder().build();
      const secondErc20Recipient = getAddress(faker.finance.ethereumAddress());
      const secondErc20Value = faker.number.int({ min: 1 }).toString();
      const dataDecoded = baseDataDecodedBuilder()
        .with('method', 'multiSend')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', 'transactions')
            .with('type', 'bytes')
            .with('valueDecoded', [
              multisendBuilder()
                // Native transfer
                .with('value', faker.number.int({ min: 1 }).toString())
                .build(),
              multisendBuilder()
                .with('value', '0')
                .with('to', firstErc20Token.address)
                .with(
                  'data',
                  erc20TransferEncoder()
                    .with('to', firstErc20Recipient)
                    .with('value', BigInt(firstErc20Value))
                    .encode(),
                )
                .with(
                  'dataDecoded',
                  baseDataDecodedBuilder()
                    .with('method', 'transfer')
                    .with('parameters', [
                      dataDecodedParameterBuilder()
                        .with('name', 'to')
                        .with('type', 'address')
                        .with('value', firstErc20Recipient)
                        .build(),
                      dataDecodedParameterBuilder()
                        .with('name', 'value')
                        .with('type', 'uint256')
                        .with('value', firstErc20Value)
                        .build(),
                    ])
                    .build(),
                )
                .build(),
              multisendBuilder()
                .with('value', '0')
                .with('to', secondErc20Token.address)
                .with(
                  'data',
                  erc20TransferEncoder()
                    .with('to', secondErc20Recipient)
                    .with('value', BigInt(secondErc20Value))
                    .encode(),
                )
                .with(
                  'dataDecoded',
                  baseDataDecodedBuilder()
                    .with('method', 'transfer')
                    .with('parameters', [
                      dataDecodedParameterBuilder()
                        .with('name', 'to')
                        .with('type', 'address')
                        .with('value', secondErc20Recipient)
                        .build(),
                      dataDecodedParameterBuilder()
                        .with('name', 'value')
                        .with('type', 'uint256')
                        .with('value', secondErc20Value)
                        .build(),
                    ])
                    .build(),
                )
                .build(),
            ])
            .build(),
        ])
        .build();
      chainsRepository.getChain.mockResolvedValue(chain);
      transactionInfoMapper.isValidTokenTransfer.mockReturnValue(true);
      tokenRepository.getToken.mockImplementation(({ address }) => {
        if (address === firstErc20Token.address) {
          return Promise.resolve(firstErc20Token);
        }
        if (address === secondErc20Token.address) {
          return Promise.resolve(secondErc20Token);
        }
        throw new Error('Token not found');
      });

      const actual = await mapper.buildTokenInfoIndex({
        chainId: chain.chainId,
        safeAddress,
        dataDecoded,
      });

      // secondErc20Token goes beyond limit
      expect(actual).toStrictEqual({
        [NULL_ADDRESS]: {
          address: NULL_ADDRESS,
          decimals: chain.nativeCurrency.decimals,
          logoUri: chain.nativeCurrency.logoUri,
          name: chain.nativeCurrency.name,
          symbol: chain.nativeCurrency.symbol,
          trusted: true,
          type: 'NATIVE_TOKEN',
        },
        [firstErc20Token.address]: {
          address: firstErc20Token.address,
          decimals: firstErc20Token.decimals,
          logoUri: firstErc20Token.logoUri,
          name: firstErc20Token.name,
          symbol: firstErc20Token.symbol,
          trusted: firstErc20Token.trusted,
          type: 'ERC20',
        },
      });
    });

    it('should not include token transfers of invalid token transfers', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const erc20Token = erc20TokenBuilder().build();
      const recipient = getAddress(faker.finance.ethereumAddress());
      const value = faker.number.int({ min: 1 }).toString();
      const dataDecoded = baseDataDecodedBuilder()
        .with('method', 'multiSend')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', 'transactions')
            .with('type', 'bytes')
            .with('valueDecoded', [
              multisendBuilder()
                .with('value', '0')
                .with('to', erc20Token.address)
                .with(
                  'data',
                  erc20TransferEncoder()
                    .with('to', recipient)
                    .with('value', BigInt(value))
                    .encode(),
                )
                .with(
                  'dataDecoded',
                  baseDataDecodedBuilder()
                    .with('method', 'transfer')
                    .with('parameters', [
                      dataDecodedParameterBuilder()
                        .with('name', 'to')
                        .with('type', 'address')
                        .with('value', recipient)
                        .build(),
                      dataDecodedParameterBuilder()
                        .with('name', 'value')
                        .with('type', 'uint256')
                        .with('value', value)
                        .build(),
                    ])
                    .build(),
                )
                .build(),
            ])
            .build(),
        ])
        .build();
      chainsRepository.getChain.mockResolvedValue(chain);
      transactionInfoMapper.isValidTokenTransfer.mockReturnValue(false);

      const actual = await mapper.buildTokenInfoIndex({
        chainId: chain.chainId,
        safeAddress,
        dataDecoded,
      });

      expect(actual).toStrictEqual({});
    });

    it('should not include tokens that cannot be found', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const erc20Token = erc20TokenBuilder().build();
      const recipient = getAddress(faker.finance.ethereumAddress());
      const value = faker.number.int({ min: 1 }).toString();
      const dataDecoded = baseDataDecodedBuilder()
        .with('method', 'multiSend')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', 'transactions')
            .with('type', 'bytes')
            .with('valueDecoded', [
              multisendBuilder()
                .with('value', '0')
                .with('to', erc20Token.address)
                .with(
                  'data',
                  erc20TransferEncoder()
                    .with('to', recipient)
                    .with('value', BigInt(value))
                    .encode(),
                )
                .with(
                  'dataDecoded',
                  baseDataDecodedBuilder()
                    .with('method', 'transfer')
                    .with('parameters', [
                      dataDecodedParameterBuilder()
                        .with('name', 'to')
                        .with('type', 'address')
                        .with('value', recipient)
                        .build(),
                      dataDecodedParameterBuilder()
                        .with('name', 'value')
                        .with('type', 'uint256')
                        .with('value', value)
                        .build(),
                    ])
                    .build(),
                )
                .build(),
            ])
            .build(),
        ])
        .build();
      chainsRepository.getChain.mockResolvedValue(chain);
      transactionInfoMapper.isValidTokenTransfer.mockReturnValue(true);
      tokenRepository.getToken.mockRejectedValue(new Error('Token not found'));

      const actual = await mapper.buildTokenInfoIndex({
        chainId: chain.chainId,
        safeAddress,
        dataDecoded,
      });

      expect(actual).toStrictEqual({});
    });
  });
});
