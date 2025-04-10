import { faker } from '@faker-js/faker';
import type { TokenRepository } from '@/domain/tokens/token.repository';
import { erc20TransferBuilder } from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import { erc721TransferBuilder } from '@/domain/safe/entities/__tests__/erc721-transfer.builder';
import { nativeTokenTransferBuilder } from '@/domain/safe/entities/__tests__/native-token-transfer.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import {
  erc20TokenBuilder,
  erc721TokenBuilder,
  tokenBuilder,
} from '@/domain/tokens/__tests__/token.builder';
import type { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import {
  TransferTransactionInfo,
  TransferDirection,
} from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { Erc20Transfer } from '@/routes/transactions/entities/transfers/erc20-transfer.entity';
import { Erc721Transfer } from '@/routes/transactions/entities/transfers/erc721-transfer.entity';
import { NativeCoinTransfer } from '@/routes/transactions/entities/transfers/native-coin-transfer.entity';
import { TransferInfoMapper } from '@/routes/transactions/mappers/transfers/transfer-info.mapper';
import { getAddress } from 'viem';
import type { SwapTransferInfoMapper } from '@/routes/transactions/mappers/transfers/swap-transfer-info.mapper';
import type { ILoggingService } from '@/logging/logging.interface';

// Note: we mock this as there is a dedicated test for this mapper
const swapTransferInfoMapper = jest.mocked({
  mapSwapTransferInfo: jest.fn(),
} as jest.MockedObjectDeep<SwapTransferInfoMapper>);

const addressInfoHelper = jest.mocked({
  getOrDefault: jest.fn(),
} as jest.MockedObjectDeep<AddressInfoHelper>);

const tokenRepository = jest.mocked({
  getToken: jest.fn(),
} as jest.MockedObjectDeep<TokenRepository>);

const mockLoggingService = jest.mocked({
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

describe('Transfer Info mapper (Unit)', () => {
  let mapper: TransferInfoMapper;

  beforeEach(() => {
    jest.resetAllMocks();
    mapper = new TransferInfoMapper(
      tokenRepository,
      swapTransferInfoMapper,
      addressInfoHelper,
      mockLoggingService,
    );
  });

  it('should build an ERC20 TransferTransactionInfo', async () => {
    const chainId = faker.string.numeric();
    const transfer = erc20TransferBuilder().build();
    const safe = safeBuilder().build();
    const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
    const token = erc20TokenBuilder()
      .with('address', getAddress(transfer.tokenAddress))
      .build();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    tokenRepository.getToken.mockResolvedValue(token);

    const actual = await mapper.mapTransferInfo(chainId, transfer, safe);

    expect(actual).toBeInstanceOf(TransferTransactionInfo);
    if (!(actual instanceof TransferTransactionInfo)) {
      throw new Error('Not a TransferTransactionInfo instance');
    }
    expect(actual.transferInfo).toBeInstanceOf(Erc20Transfer);
    expect(actual).toEqual(
      expect.objectContaining({
        sender: addressInfo,
        recipient: addressInfo,
        direction: TransferDirection.Unknown,
        transferInfo: expect.objectContaining({
          type: 'ERC20',
          tokenAddress: transfer.tokenAddress,
          value: transfer.value,
          tokenName: token.name,
          tokenSymbol: token.symbol,
          logoUri: token.logoUri,
          decimals: token.decimals,
        }),
      }),
    );
  });

  it('should build an ERC20 TransferTransactionInfo without token info if fetching it fails', async () => {
    const chainId = faker.string.numeric();
    const transfer = erc20TransferBuilder().build();
    const safe = safeBuilder().build();
    const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    tokenRepository.getToken.mockRejectedValue(
      new Error('Failed to fetch token'),
    );

    const actual = await mapper.mapTransferInfo(chainId, transfer, safe);

    expect(actual).toBeInstanceOf(TransferTransactionInfo);
    if (!(actual instanceof TransferTransactionInfo)) {
      throw new Error('Not a TransferTransactionInfo instance');
    }
    expect(actual.transferInfo).toBeInstanceOf(Erc20Transfer);
    expect(actual).toEqual(
      expect.objectContaining({
        sender: addressInfo,
        recipient: addressInfo,
        direction: TransferDirection.Unknown,
        transferInfo: expect.objectContaining({
          type: 'ERC20',
          tokenAddress: transfer.tokenAddress,
          value: transfer.value,
          tokenName: null,
          tokenSymbol: null,
          logoUri: null,
          decimals: null,
        }),
      }),
    );
  });

  it('should build an ERC721 TransferTransactionInfo', async () => {
    const chainId = faker.string.numeric();
    const transfer = erc721TransferBuilder().build();
    const safe = safeBuilder().build();
    const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
    const token = erc721TokenBuilder()
      .with('address', getAddress(transfer.tokenAddress))
      .build();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    tokenRepository.getToken.mockResolvedValue(token);

    const actual = await mapper.mapTransferInfo(chainId, transfer, safe);

    expect(actual).toBeInstanceOf(TransferTransactionInfo);
    if (!(actual instanceof TransferTransactionInfo)) {
      throw new Error('Not a TransferTransactionInfo instance');
    }
    expect(actual.transferInfo).toBeInstanceOf(Erc721Transfer);
    expect(actual).toEqual(
      expect.objectContaining({
        sender: addressInfo,
        recipient: addressInfo,
        direction: TransferDirection.Unknown,
        transferInfo: expect.objectContaining({
          type: 'ERC721',
          tokenAddress: transfer.tokenAddress,
          tokenId: transfer.tokenId,
          tokenName: token.name,
          tokenSymbol: token.symbol,
          logoUri: token.logoUri,
        }),
      }),
    );
  });

  it('should build an ERC721 TransferTransactionInfo without token info if fetching it fails', async () => {
    const chainId = faker.string.numeric();
    const transfer = erc721TransferBuilder().build();
    const safe = safeBuilder().build();
    const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    tokenRepository.getToken.mockRejectedValue(
      new Error('Failed to fetch token'),
    );

    const actual = await mapper.mapTransferInfo(chainId, transfer, safe);

    expect(actual).toBeInstanceOf(TransferTransactionInfo);
    if (!(actual instanceof TransferTransactionInfo)) {
      throw new Error('Not a TransferTransactionInfo instance');
    }
    expect(actual.transferInfo).toBeInstanceOf(Erc721Transfer);
    expect(actual).toEqual(
      expect.objectContaining({
        sender: addressInfo,
        recipient: addressInfo,
        direction: TransferDirection.Unknown,
        transferInfo: expect.objectContaining({
          type: 'ERC721',
          tokenAddress: transfer.tokenAddress,
          tokenId: transfer.tokenId,
          tokenName: null,
          tokenSymbol: null,
          logoUri: null,
        }),
      }),
    );
  });

  it('should build an Native Token TransferTransactionInfo', async () => {
    const chainId = faker.string.numeric();
    const transfer = nativeTokenTransferBuilder().build();
    const safe = safeBuilder().build();
    const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
    const token = tokenBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    tokenRepository.getToken.mockResolvedValue(token);

    const actual = await mapper.mapTransferInfo(chainId, transfer, safe);

    expect(actual).toBeInstanceOf(TransferTransactionInfo);
    if (!(actual instanceof TransferTransactionInfo)) {
      throw new Error('Not a TransferTransactionInfo instance');
    }
    expect(actual.transferInfo).toBeInstanceOf(NativeCoinTransfer);
    expect(actual).toEqual(
      expect.objectContaining({
        sender: addressInfo,
        recipient: addressInfo,
        direction: TransferDirection.Unknown,
        transferInfo: expect.objectContaining({
          type: 'NATIVE_COIN',
          value: transfer.value,
        }),
      }),
    );
  });
});
