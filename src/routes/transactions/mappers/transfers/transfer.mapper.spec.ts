import { erc20TransferBuilder } from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import { erc721TransferBuilder } from '@/domain/safe/entities/__tests__/erc721-transfer.builder';
import { nativeTokenTransferBuilder } from '@/domain/safe/entities/__tests__/native-token-transfer.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { TokenRepository } from '@/domain/tokens/token.repository';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { TransactionStatus } from '@/routes/transactions/entities/transaction-status.entity';
import { Transaction } from '@/routes/transactions/entities/transaction.entity';
import { TransferTransactionInfo } from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { TransferInfoMapper } from '@/routes/transactions/mappers/transfers/transfer-info.mapper';
import { TransferMapper } from '@/routes/transactions/mappers/transfers/transfer.mapper';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

const addressInfoHelper = jest.mocked({
  getOrDefault: jest.fn(),
} as jest.MockedObjectDeep<AddressInfoHelper>);

const tokenRepository = jest.mocked({
  getToken: jest.fn(),
} as jest.MockedObjectDeep<TokenRepository>);

describe('Transfer mapper (Unit)', () => {
  let mapper: TransferMapper;

  beforeEach(() => {
    jest.resetAllMocks();
    const transferInfoMapper = new TransferInfoMapper(
      tokenRepository,
      addressInfoHelper,
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
          .with('address', getAddress(transfer.tokenAddress!))
          .build();
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
            .with('address', getAddress(transfer.tokenAddress!))
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
            .with('address', getAddress(transfer.tokenAddress!))
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
            .with('address', getAddress(transfer.tokenAddress!))
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
            .with('address', getAddress(transfer.tokenAddress!))
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
        .with('address', getAddress(erc721Transfer.tokenAddress!))
        .build();
      const trustedErc20TransferWithValue = erc20TransferBuilder()
        .with('value', '1')
        .with('from', safe.address)
        .build();
      const trustedErc20Token = tokenBuilder()
        .with(
          'address',
          getAddress(trustedErc20TransferWithValue.tokenAddress!),
        )
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
        .with(
          'address',
          getAddress(trustedErc20TransferWithValue.tokenAddress!),
        )
        .with('trusted', false)
        .build();
      const untrustedErc20TransferWithoutValue = erc20TransferBuilder()
        .with('value', '0')
        .build();
      addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
      tokenRepository.getToken
        .mockResolvedValueOnce(erc721Token)
        .mockResolvedValueOnce(trustedErc20Token)
        .mockResolvedValueOnce(trustedErc20Token)
        .mockResolvedValueOnce(untrustedErc20Token)
        .mockResolvedValueOnce(untrustedErc20Token);

      const actual = await mapper.mapTransfers({
        chainId,
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
        },
        expect.objectContaining({
          id: `transfer_${safe.address}_${erc721Transfer.transferId}`,
          timestamp: erc721Transfer.executionDate.getTime(),
          txStatus: TransactionStatus.Success,
          txInfo: expect.any(TransferTransactionInfo),
          executionInfo: null,
          safeAppInfo: null,
        }),
        expect.objectContaining({
          id: `transfer_${safe.address}_${trustedErc20TransferWithValue.transferId}`,
          timestamp: trustedErc20TransferWithValue.executionDate.getTime(),
          txStatus: TransactionStatus.Success,
          txInfo: expect.any(TransferTransactionInfo),
          executionInfo: null,
          safeAppInfo: null,
        }),
      ]);
    });
  });
});
