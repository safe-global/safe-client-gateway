// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '#/logging/logging.interface';
import { erc20TransferBuilder } from '#/modules/safe/domain/entities/__tests__/erc20-transfer.builder';
import { erc721TransferBuilder } from '#/modules/safe/domain/entities/__tests__/erc721-transfer.builder';
import { nativeTokenTransferBuilder } from '#/modules/safe/domain/entities/__tests__/native-token-transfer.builder';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import {
  erc20TokenBuilder,
  erc721TokenBuilder,
  tokenBuilder,
} from '#/modules/tokens/domain/__tests__/token.builder';
import {
  TransferDirection,
  TransferTransactionInfo,
} from '#/modules/transactions/routes/entities/transfer-transaction-info.entity';
import { Erc20Transfer } from '#/modules/transactions/routes/entities/transfers/erc20-transfer.entity';
import { Erc721Transfer } from '#/modules/transactions/routes/entities/transfers/erc721-transfer.entity';
import { NativeCoinTransfer } from '#/modules/transactions/routes/entities/transfers/native-coin-transfer.entity';
import type { SwapTransferInfoMapper } from '#/modules/transactions/routes/mappers/transfers/swap-transfer-info.mapper';
import { TransferInfoMapper } from '#/modules/transactions/routes/mappers/transfers/transfer-info.mapper';
import type { AddressLookups } from '#/routes/common/address-info/address-lookups';
import { AddressInfo } from '#/routes/common/entities/address-info.entity';

// Note: we mock this as there is a dedicated test for this mapper
const swapTransferInfoMapper = vi.mocked({
  mapSwapTransferInfo: vi.fn(),
} as MockedObject<SwapTransferInfoMapper>);

const addressLookups = vi.mocked({
  getOrDefault: vi.fn(),
  getToken: vi.fn(),
} as MockedObject<AddressLookups>);

const mockLoggingService = vi.mocked({
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>);

describe('Transfer Info mapper (Unit)', () => {
  let mapper: TransferInfoMapper;

  beforeEach(() => {
    vi.resetAllMocks();
    mapper = new TransferInfoMapper(swapTransferInfoMapper, mockLoggingService);
  });

  it('should build an ERC20 TransferTransactionInfo', async () => {
    const chainId = faker.string.numeric();
    const transfer = erc20TransferBuilder().build();
    const safe = safeBuilder().build();
    const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
    const token = erc20TokenBuilder()
      .with('address', getAddress(transfer.tokenAddress))
      .build();
    addressLookups.getOrDefault.mockResolvedValue(addressInfo);
    addressLookups.getToken.mockResolvedValue(token);

    const actual = await mapper.mapTransferInfo(
      chainId,
      transfer,
      safe,
      addressLookups,
    );

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
    addressLookups.getOrDefault.mockResolvedValue(addressInfo);
    addressLookups.getToken.mockRejectedValue(
      new Error('Failed to fetch token'),
    );

    const actual = await mapper.mapTransferInfo(
      chainId,
      transfer,
      safe,
      addressLookups,
    );

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
    addressLookups.getOrDefault.mockResolvedValue(addressInfo);
    addressLookups.getToken.mockResolvedValue(token);

    const actual = await mapper.mapTransferInfo(
      chainId,
      transfer,
      safe,
      addressLookups,
    );

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
    addressLookups.getOrDefault.mockResolvedValue(addressInfo);
    addressLookups.getToken.mockRejectedValue(
      new Error('Failed to fetch token'),
    );

    const actual = await mapper.mapTransferInfo(
      chainId,
      transfer,
      safe,
      addressLookups,
    );

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
    addressLookups.getOrDefault.mockResolvedValue(addressInfo);
    addressLookups.getToken.mockResolvedValue(token);

    const actual = await mapper.mapTransferInfo(
      chainId,
      transfer,
      safe,
      addressLookups,
    );

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
