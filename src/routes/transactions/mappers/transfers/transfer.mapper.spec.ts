import { IConfigurationService } from '@/config/configuration.service.interface';
import { erc20TransferBuilder } from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import { erc721TransferBuilder } from '@/domain/safe/entities/__tests__/erc721-transfer.builder';
import { nativeTokenTransferBuilder } from '@/domain/safe/entities/__tests__/native-token-transfer.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import {
  OrderClass,
  OrderKind,
  OrderStatus,
} from '@/domain/swaps/entities/order.entity';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { TokenType } from '@/domain/tokens/entities/token.entity';
import { TokenRepository } from '@/domain/tokens/token.repository';
import { ILoggingService } from '@/logging/logging.interface';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { TransactionInfoType } from '@/routes/transactions/entities/transaction-info.entity';
import { TransactionStatus } from '@/routes/transactions/entities/transaction-status.entity';
import { Transaction } from '@/routes/transactions/entities/transaction.entity';
import {
  TransferDirection,
  TransferTransactionInfo,
} from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { TransferType } from '@/routes/transactions/entities/transfers/transfer.entity';
import { SwapTransferInfoMapper } from '@/routes/transactions/mappers/transfers/swap-transfer-info.mapper';
import { TransferInfoMapper } from '@/routes/transactions/mappers/transfers/transfer-info.mapper';
import { TransferMapper } from '@/routes/transactions/mappers/transfers/transfer.mapper';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

const configurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

const addressInfoHelper = jest.mocked({
  getOrDefault: jest.fn(),
} as jest.MockedObjectDeep<AddressInfoHelper>);

const tokenRepository = jest.mocked({
  getToken: jest.fn(),
} as jest.MockedObjectDeep<TokenRepository>);

const swapTransferInfoMapper = jest.mocked({
  mapSwapTransferInfo: jest.fn(),
} as jest.MockedObjectDeep<SwapTransferInfoMapper>);

const mockLoggingService = jest.mocked({
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

describe('Transfer mapper (Unit)', () => {
  let mapper: TransferMapper;

  beforeEach(() => {
    jest.resetAllMocks();

    const transferInfoMapper = new TransferInfoMapper(
      configurationService,
      tokenRepository,
      swapTransferInfoMapper,
      addressInfoHelper,
      mockLoggingService,
    );
    mapper = new TransferMapper(transferInfoMapper);
  });

  describe('mapTransfers', () => {
    describe('native transfers', () => {
      it.each([
        ['with', true],
        ['without', false],
      ])(`should map transfers %s onlyTrusted flag`, async (_, onlyTrusted) => {
        const chainId = faker.string.numeric();
        const safe = safeBuilder().build();
        const transfer = nativeTokenTransferBuilder()
          .with('from', safe.address)
          .build();
        const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
        addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);

        const actual = await mapper.mapTransfers({
          chainId,
          transfers: [transfer],
          safe,
          onlyTrusted,
        });

        expect(
          actual.every((transaction) => transaction instanceof Transaction),
        ).toBe(true);
        expect(actual).toEqual([
          {
            id: `transfer_${safe.address}_${transfer.transferId}`,
            timestamp: transfer.executionDate.getTime(),
            txStatus: TransactionStatus.Success,
            txInfo: expect.any(TransferTransactionInfo),
            executionInfo: null,
            safeAppInfo: null,
            txHash: transfer.transactionHash,
          },
        ]);
      });
    });

    describe('ERC721 transfers', () => {
      it.each([
        ['with', true],
        ['without', false],
      ])(`should map transfers %s onlyTrusted flag`, async (_, onlyTrusted) => {
        const chainId = faker.string.numeric();
        const safe = safeBuilder().build();
        const transfer = erc721TransferBuilder()
          .with('from', safe.address)
          .build();
        const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
        const token = tokenBuilder()
          .with('address', getAddress(transfer.tokenAddress))
          .build();
        swapTransferInfoMapper.mapSwapTransferInfo.mockRejectedValue(
          'Not settlement',
        );
        addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
        tokenRepository.getToken.mockResolvedValue(token);

        const actual = await mapper.mapTransfers({
          chainId,
          transfers: [transfer],
          safe,
          onlyTrusted,
        });

        expect(
          actual.every((transaction) => transaction instanceof Transaction),
        ).toBe(true);
        expect(actual).toEqual([
          {
            id: `transfer_${safe.address}_${transfer.transferId}`,
            timestamp: transfer.executionDate.getTime(),
            txStatus: TransactionStatus.Success,
            txInfo: expect.any(TransferTransactionInfo),
            executionInfo: null,
            safeAppInfo: null,
            txHash: transfer.transactionHash,
          },
        ]);
      });
    });

    describe('ERC20 transfers', () => {
      describe('without onlyTrusted flag', () => {
        it('should map transfers of trusted tokens with value', async () => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().build();
          const transfer = erc20TransferBuilder()
            .with('value', '1')
            .with('from', safe.address)
            .build();
          const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
          const token = tokenBuilder()
            .with('address', getAddress(transfer.tokenAddress))
            .with('trusted', true)
            .build();
          swapTransferInfoMapper.mapSwapTransferInfo.mockRejectedValue(
            'Not settlement',
          );
          addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
          tokenRepository.getToken.mockResolvedValue(token);

          const actual = await mapper.mapTransfers({
            chainId,
            transfers: [transfer],
            safe,
            onlyTrusted: false,
          });

          expect(
            actual.every((transaction) => transaction instanceof Transaction),
          ).toBe(true);
          expect(actual).toEqual([
            {
              id: `transfer_${safe.address}_${transfer.transferId}`,
              timestamp: transfer.executionDate.getTime(),
              txStatus: TransactionStatus.Success,
              txInfo: expect.any(TransferTransactionInfo),
              executionInfo: null,
              safeAppInfo: null,
              txHash: transfer.transactionHash,
            },
          ]);
        });

        it('should map transfers of trusted tokens without value', async () => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().build();
          const transfer = erc20TransferBuilder()
            .with('value', '0')
            .with('from', safe.address)
            .build();
          const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
          const token = tokenBuilder()
            .with('address', getAddress(transfer.tokenAddress))
            .with('trusted', true)
            .build();
          addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
          tokenRepository.getToken.mockResolvedValue(token);

          const actual = await mapper.mapTransfers({
            chainId,
            transfers: [transfer],
            safe,
            onlyTrusted: false,
          });

          expect(actual).toEqual([]);
        });
      });

      describe('with onlyTrusted flag', () => {
        it('should map transfers of trusted tokens with value', async () => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().build();
          const transfer = erc20TransferBuilder()
            .with('value', '1')
            .with('from', safe.address)
            .build();
          const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
          const token = tokenBuilder()
            .with('address', getAddress(transfer.tokenAddress))
            .with('trusted', true)
            .build();
          addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
          tokenRepository.getToken.mockResolvedValue(token);

          const actual = await mapper.mapTransfers({
            chainId,
            transfers: [transfer],
            safe,
            onlyTrusted: true,
          });

          expect(
            actual.every((transaction) => transaction instanceof Transaction),
          ).toBe(true);
          expect(actual).toEqual([
            {
              id: `transfer_${safe.address}_${transfer.transferId}`,
              timestamp: transfer.executionDate.getTime(),
              txStatus: TransactionStatus.Success,
              txInfo: expect.any(TransferTransactionInfo),
              executionInfo: null,
              safeAppInfo: null,
              txHash: transfer.transactionHash,
            },
          ]);
        });

        it.each([
          [
            'should not map transfers of trusted tokens without value',
            { trusted: true, value: '0' },
          ],
          [
            'should not map transfers of untrusted tokens with value',
            { trusted: false, value: '1' },
          ],
          [
            'should not map transfers of untrusted tokens without value',
            { trusted: false, value: '0' },
          ],
        ])('%s', async (_, { trusted, value }) => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().build();
          const transfer = erc20TransferBuilder()
            .with('value', value)
            .with('from', safe.address)
            .build();
          const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
          const token = tokenBuilder()
            .with('address', getAddress(transfer.tokenAddress))
            .with('trusted', trusted)
            .build();
          addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
          tokenRepository.getToken.mockResolvedValue(token);

          const actual = await mapper.mapTransfers({
            chainId,
            transfers: [transfer],
            safe,
            onlyTrusted: true,
          });

          expect(actual).toEqual([]);
        });
      });
    });

    describe('ERC20 swap transfers', () => {
      // Note: swap transfers can never have a value of 0

      describe('without onlyTrusted flag', () => {
        it('should map swap transfers of trusted tokens with value', async () => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().build();
          /**
           * TODO: Mock the following
           * @see https://sepolia.etherscan.io/tx/0x5779dc3891a4693a4c6f44eb86abd4c553e3d3d36cacfc2c791b87b6c136f148
           */
          const transfer = {
            type: 'ERC20_TRANSFER',
            executionDate: new Date('2024-07-04T09:22:48Z'),
            blockNumber: 6243548,
            transactionHash:
              '0x5779dc3891a4693a4c6f44eb86abd4c553e3d3d36cacfc2c791b87b6c136f148',
            to: safe.address,
            value: '1625650639290905524',
            tokenId: null,
            tokenAddress: '0xd3f3d46FeBCD4CdAa2B83799b7A5CdcB69d135De',
            transferId:
              'e5779dc3891a4693a4c6f44eb86abd4c553e3d3d36cacfc2c791b87b6c136f148120',
            tokenInfo: {
              type: 'ERC20',
              address: '0xd3f3d46FeBCD4CdAa2B83799b7A5CdcB69d135De',
              name: 'GNO (test)',
              symbol: 'GNO',
              decimals: 18,
              logoUri:
                'https://safe-transaction-assets.safe.global/tokens/logos/0xd3f3d46FeBCD4CdAa2B83799b7A5CdcB69d135De.png',
              trusted: true,
            },
            from: safe.address,
          } as const;
          const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
          swapTransferInfoMapper.mapSwapTransferInfo.mockResolvedValue({
            type: TransactionInfoType.SwapTransfer,
            humanDescription: null,
            richDecodedInfo: null,
            sender: {
              value: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
              name: 'GPv2Settlement',
              logoUri:
                'https://safe-transaction-assets.safe.global/contracts/logos/0x9008D19f58AAbD9eD0D60971565AA8510560ab41.png',
            },
            recipient: {
              value: safe.address,
              name: 'GnosisSafeProxy',
              logoUri: null,
            },
            direction: TransferDirection.Incoming,
            transferInfo: { ...transfer.tokenInfo, type: TransferType.Erc20 },
            uid: '0xf48010ff178567a04cb9e82341325d2bdcbf646b4ed54ef0305163368819f4bd2a73e61bd15b25b6958b4da3bfc759ca4db249b96686709e',
            status: OrderStatus.Fulfilled,
            kind: OrderKind.Sell,
            orderClass: OrderClass.Limit,
            validUntil: 1720086686,
            sellAmount: '10000000000000000000',
            buyAmount: '1608062657377840160',
            executedSellAmount: '10000000000000000000',
            executedBuyAmount: '1625650639290905524',
            sellToken: tokenBuilder().build() as TokenInfo & {
              decimals: number;
            },
            buyToken: transfer.tokenInfo,
            explorerUrl:
              'https://explorer.cow.fi/orders/0xf48010ff178567a04cb9e82341325d2bdcbf646b4ed54ef0305163368819f4bd2a73e61bd15b25b6958b4da3bfc759ca4db249b96686709e',
            executedSurplusFee: '1400734851526479789',
            receiver: safe.address,
            owner: safe.address,
            fullAppData: {
              appCode: 'CoW Swap-SafeApp',
              environment: 'production',
              metadata: {
                orderClass: {
                  orderClass: 'market',
                },
                quote: {
                  slippageBips: 40,
                },
              },
              version: '1.1.0',
            },
          } as const);
          addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
          tokenRepository.getToken.mockResolvedValue({
            ...transfer.tokenInfo,
            type: TokenType.Erc20,
          });

          const actual = await mapper.mapTransfers({
            chainId,
            transfers: [transfer],
            safe,
            onlyTrusted: false,
          });

          expect(
            actual.every((transaction) => transaction instanceof Transaction),
          ).toBe(true);
          expect(actual).toEqual([
            {
              id: `transfer_${safe.address}_${transfer.transferId}`,
              timestamp: transfer.executionDate.getTime(),
              txStatus: TransactionStatus.Success,
              txInfo: expect.any(TransferTransactionInfo),
              executionInfo: null,
              safeAppInfo: null,
              txHash: transfer.transactionHash,
            },
          ]);
        });
      });

      describe('with onlyTrusted flag', () => {
        it('should map swap transfers of trusted tokens', async () => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().build();
          /**
           * TODO: Mock the following
           * @see https://sepolia.etherscan.io/tx/0x5779dc3891a4693a4c6f44eb86abd4c553e3d3d36cacfc2c791b87b6c136f148
           */
          const transfer = {
            type: 'ERC20_TRANSFER',
            executionDate: new Date('2024-07-04T09:22:48Z'),
            blockNumber: 6243548,
            transactionHash:
              '0x5779dc3891a4693a4c6f44eb86abd4c553e3d3d36cacfc2c791b87b6c136f148',
            to: safe.address,
            value: '1625650639290905524',
            tokenId: null,
            tokenAddress: '0xd3f3d46FeBCD4CdAa2B83799b7A5CdcB69d135De',
            transferId:
              'e5779dc3891a4693a4c6f44eb86abd4c553e3d3d36cacfc2c791b87b6c136f148120',
            tokenInfo: {
              type: 'ERC20',
              address: '0xd3f3d46FeBCD4CdAa2B83799b7A5CdcB69d135De',
              name: 'GNO (test)',
              symbol: 'GNO',
              decimals: 18,
              logoUri:
                'https://safe-transaction-assets.safe.global/tokens/logos/0xd3f3d46FeBCD4CdAa2B83799b7A5CdcB69d135De.png',
              trusted: true,
            },
            from: safe.address,
          } as const;
          const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
          swapTransferInfoMapper.mapSwapTransferInfo.mockResolvedValue({
            type: TransactionInfoType.SwapTransfer,
            humanDescription: null,
            richDecodedInfo: null,
            sender: {
              value: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
              name: 'GPv2Settlement',
              logoUri:
                'https://safe-transaction-assets.safe.global/contracts/logos/0x9008D19f58AAbD9eD0D60971565AA8510560ab41.png',
            },
            recipient: {
              value: safe.address,
              name: 'GnosisSafeProxy',
              logoUri: null,
            },
            direction: TransferDirection.Incoming,
            transferInfo: { ...transfer.tokenInfo, type: TransferType.Erc20 },
            uid: '0xf48010ff178567a04cb9e82341325d2bdcbf646b4ed54ef0305163368819f4bd2a73e61bd15b25b6958b4da3bfc759ca4db249b96686709e',
            status: OrderStatus.Fulfilled,
            kind: OrderKind.Sell,
            orderClass: OrderClass.Limit,
            validUntil: 1720086686,
            sellAmount: '10000000000000000000',
            buyAmount: '1608062657377840160',
            executedSellAmount: '10000000000000000000',
            executedBuyAmount: '1625650639290905524',
            sellToken: tokenBuilder().build() as TokenInfo & {
              decimals: number;
            },
            buyToken: transfer.tokenInfo,
            explorerUrl:
              'https://explorer.cow.fi/orders/0xf48010ff178567a04cb9e82341325d2bdcbf646b4ed54ef0305163368819f4bd2a73e61bd15b25b6958b4da3bfc759ca4db249b96686709e',
            executedSurplusFee: '1400734851526479789',
            receiver: safe.address,
            owner: safe.address,
            fullAppData: {
              appCode: 'CoW Swap-SafeApp',
              environment: 'production',
              metadata: {
                orderClass: {
                  orderClass: 'market',
                },
                quote: {
                  slippageBips: 40,
                },
              },
              version: '1.1.0',
            },
          } as const);
          addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
          tokenRepository.getToken.mockResolvedValue({
            ...transfer.tokenInfo,
            type: TokenType.Erc20,
          });

          const actual = await mapper.mapTransfers({
            chainId,
            transfers: [transfer],
            safe,
            onlyTrusted: true,
          });

          expect(
            actual.every((transaction) => transaction instanceof Transaction),
          ).toBe(true);
          expect(actual).toEqual([
            {
              id: `transfer_${safe.address}_${transfer.transferId}`,
              timestamp: transfer.executionDate.getTime(),
              txStatus: TransactionStatus.Success,
              txInfo: expect.any(TransferTransactionInfo),
              executionInfo: null,
              safeAppInfo: null,
              txHash: transfer.transactionHash,
            },
          ]);
        });

        it('should not map transfers of untrusted tokens', async () => {
          const chainId = faker.string.numeric();
          const safe = safeBuilder().build();
          /**
           * TODO: Mock the following
           * @see https://sepolia.etherscan.io/tx/0x5779dc3891a4693a4c6f44eb86abd4c553e3d3d36cacfc2c791b87b6c136f148
           */
          const transfer = {
            type: 'ERC20_TRANSFER',
            executionDate: new Date('2024-07-04T09:22:48Z'),
            blockNumber: 6243548,
            transactionHash:
              '0x5779dc3891a4693a4c6f44eb86abd4c553e3d3d36cacfc2c791b87b6c136f148',
            to: safe.address,
            value: '1625650639290905524',
            tokenId: null,
            tokenAddress: '0xd3f3d46FeBCD4CdAa2B83799b7A5CdcB69d135De',
            transferId:
              'e5779dc3891a4693a4c6f44eb86abd4c553e3d3d36cacfc2c791b87b6c136f148120',
            tokenInfo: {
              type: 'ERC20',
              address: '0xd3f3d46FeBCD4CdAa2B83799b7A5CdcB69d135De',
              name: 'GNO (test)',
              symbol: 'GNO',
              decimals: 18,
              logoUri:
                'https://safe-transaction-assets.safe.global/tokens/logos/0xd3f3d46FeBCD4CdAa2B83799b7A5CdcB69d135De.png',
              trusted: false,
            },
            from: safe.address,
          } as const;
          const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
          swapTransferInfoMapper.mapSwapTransferInfo.mockResolvedValue({
            type: TransactionInfoType.SwapTransfer,
            humanDescription: null,
            richDecodedInfo: null,
            sender: {
              value: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
              name: 'GPv2Settlement',
              logoUri:
                'https://safe-transaction-assets.safe.global/contracts/logos/0x9008D19f58AAbD9eD0D60971565AA8510560ab41.png',
            },
            recipient: {
              value: safe.address,
              name: 'GnosisSafeProxy',
              logoUri: null,
            },
            direction: TransferDirection.Incoming,
            transferInfo: { ...transfer.tokenInfo, type: TransferType.Erc20 },
            uid: '0xf48010ff178567a04cb9e82341325d2bdcbf646b4ed54ef0305163368819f4bd2a73e61bd15b25b6958b4da3bfc759ca4db249b96686709e',
            status: OrderStatus.Fulfilled,
            kind: OrderKind.Sell,
            orderClass: OrderClass.Limit,
            validUntil: 1720086686,
            sellAmount: '10000000000000000000',
            buyAmount: '1608062657377840160',
            executedSellAmount: '10000000000000000000',
            executedBuyAmount: '1625650639290905524',
            sellToken: tokenBuilder().build() as TokenInfo & {
              decimals: number;
            },
            buyToken: transfer.tokenInfo,
            explorerUrl:
              'https://explorer.cow.fi/orders/0xf48010ff178567a04cb9e82341325d2bdcbf646b4ed54ef0305163368819f4bd2a73e61bd15b25b6958b4da3bfc759ca4db249b96686709e',
            executedSurplusFee: '1400734851526479789',
            receiver: safe.address,
            owner: safe.address,
            fullAppData: {
              appCode: 'CoW Swap-SafeApp',
              environment: 'production',
              metadata: {
                orderClass: {
                  orderClass: 'market',
                },
                quote: {
                  slippageBips: 40,
                },
              },
              version: '1.1.0',
            },
          } as const);
          addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
          tokenRepository.getToken.mockResolvedValue({
            ...transfer.tokenInfo,
            type: TokenType.Erc20,
          });

          const actual = await mapper.mapTransfers({
            chainId,
            transfers: [transfer],
            safe,
            onlyTrusted: true,
          });

          expect(actual).toEqual([]);
        });
      });
    });

    it('should map and filter a mixture of transfers', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().build();
      const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
      const nativeTransfer = nativeTokenTransferBuilder()
        .with('from', safe.address)
        .build();
      const erc721Transfer = erc721TransferBuilder()
        .with('from', safe.address)
        .build();
      const erc721Token = tokenBuilder()
        .with('address', getAddress(erc721Transfer.tokenAddress))
        .build();
      const trustedErc20TransferWithValue = erc20TransferBuilder()
        .with('value', '1')
        .with('from', safe.address)
        .build();
      const trustedErc20Token = tokenBuilder()
        .with('address', getAddress(trustedErc20TransferWithValue.tokenAddress))
        .with('trusted', true)
        .build();
      const trustedErc20TransferWithoutValue = erc20TransferBuilder()
        .with('value', '0')
        .with('from', safe.address)
        .build();
      const untrustedErc20TransferWithValue = erc20TransferBuilder()
        .with('value', '1')
        .with('from', safe.address)
        .build();
      const untrustedErc20Token = tokenBuilder()
        .with('address', getAddress(trustedErc20TransferWithValue.tokenAddress))
        .with('trusted', false)
        .build();
      const untrustedErc20TransferWithoutValue = erc20TransferBuilder()
        .with('value', '0')
        .build();
      swapTransferInfoMapper.mapSwapTransferInfo.mockRejectedValue(
        'Not settlement',
      );
      addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
      tokenRepository.getToken
        .mockResolvedValueOnce(erc721Token)
        .mockResolvedValueOnce(trustedErc20Token)
        .mockResolvedValueOnce(trustedErc20Token)
        .mockResolvedValueOnce(untrustedErc20Token)
        .mockResolvedValueOnce(untrustedErc20Token);

      const actual = await mapper.mapTransfers({
        chainId,
        // TODO: Add swap transfers
        transfers: [
          nativeTransfer,
          erc721Transfer,
          trustedErc20TransferWithValue,
          trustedErc20TransferWithoutValue,
          untrustedErc20TransferWithValue,
          untrustedErc20TransferWithoutValue,
        ],
        safe,
        onlyTrusted: true,
      });

      expect(
        actual.every((transaction) => transaction instanceof Transaction),
      ).toBe(true);
      expect(actual).toEqual([
        {
          id: `transfer_${safe.address}_${nativeTransfer.transferId}`,
          timestamp: nativeTransfer.executionDate.getTime(),
          txStatus: TransactionStatus.Success,
          txInfo: expect.any(TransferTransactionInfo),
          executionInfo: null,
          safeAppInfo: null,
          txHash: nativeTransfer.transactionHash,
        },
        expect.objectContaining({
          id: `transfer_${safe.address}_${erc721Transfer.transferId}`,
          timestamp: erc721Transfer.executionDate.getTime(),
          txStatus: TransactionStatus.Success,
          txInfo: expect.any(TransferTransactionInfo),
          executionInfo: null,
          safeAppInfo: null,
          txHash: erc721Transfer.transactionHash,
        }),
        expect.objectContaining({
          id: `transfer_${safe.address}_${trustedErc20TransferWithValue.transferId}`,
          timestamp: trustedErc20TransferWithValue.executionDate.getTime(),
          txStatus: TransactionStatus.Success,
          txInfo: expect.any(TransferTransactionInfo),
          executionInfo: null,
          safeAppInfo: null,
          txHash: trustedErc20TransferWithValue.transactionHash,
        }),
      ]);
    });
  });
});
