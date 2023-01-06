import { faker } from '@faker-js/faker';
import erc721TransferFactory from '../../../../domain/safe/entities/__tests__/erc721-transfer.factory';
import nativeTokenTransferFactory from '../../../../domain/safe/entities/__tests__/native-token-transfer.factory';
import safeFactory from '../../../../domain/safe/entities/__tests__/safe.factory';
import { TokenRepository } from '../../../../domain/tokens/token.repository';
import tokenFactory from '../../../../domain/tokens/__tests__/token.factory';
import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import {
  TransferDirection,
  TransferTransactionInfo,
} from '../../entities/transfer-transaction-info.entity';
import { Erc20Transfer } from '../../entities/transfers/erc20-transfer.entity';
import { Erc721Transfer } from '../../entities/transfers/erc721-transfer.entity';
import { NativeCoinTransfer } from '../../entities/transfers/native-coin-transfer.entity';
import { TransferInfoMapper } from './transfer-info.mapper';
import { ERC20TransferBuilder } from '../../../../domain/safe/entities/__tests__/erc20-transfer.factory';

const addressInfoHelper = jest.mocked({
  getOrDefault: jest.fn(),
} as unknown as AddressInfoHelper);

const tokenRepository = jest.mocked({
  getToken: jest.fn(),
} as unknown as TokenRepository);

describe('Transfer Info mapper (Unit)', () => {
  const mapper = new TransferInfoMapper(tokenRepository, addressInfoHelper);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should build an ERC20 TransferTransactionInfo', async () => {
    const chainId = faker.random.numeric();
    const transfer = new ERC20TransferBuilder().build();
    const safe = safeFactory();
    const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
    const token = tokenFactory();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    tokenRepository.getToken.mockResolvedValue(token);

    const actual = await mapper.mapTransferInfo(chainId, transfer, safe);

    expect(actual).toBeInstanceOf(TransferTransactionInfo);
    expect(actual.transferInfo).toBeInstanceOf(Erc20Transfer);
    expect(actual).toEqual(
      expect.objectContaining({
        sender: addressInfo,
        recipient: addressInfo,
        direction: TransferDirection.Unknown,
        transferInfo: expect.objectContaining({
          type: 'ERC20',
          tokenAddress: token.address,
          value: transfer.value,
          tokenName: token.name,
          tokenSymbol: token.symbol,
          logoUri: token.logoUri,
          decimals: token.decimals,
        }),
      }),
    );
  });

  it('should build an ERC721 TransferTransactionInfo', async () => {
    const chainId = faker.random.numeric();
    const transfer = erc721TransferFactory();
    const safe = safeFactory();
    const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
    const token = tokenFactory();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    tokenRepository.getToken.mockResolvedValue(token);

    const actual = await mapper.mapTransferInfo(chainId, transfer, safe);

    expect(actual).toBeInstanceOf(TransferTransactionInfo);
    expect(actual.transferInfo).toBeInstanceOf(Erc721Transfer);
    expect(actual).toEqual(
      expect.objectContaining({
        sender: addressInfo,
        recipient: addressInfo,
        direction: TransferDirection.Unknown,
        transferInfo: expect.objectContaining({
          type: 'ERC721',
          tokenAddress: token.address,
          tokenId: transfer.tokenId,
          tokenName: token.name,
          tokenSymbol: token.symbol,
          logoUri: token.logoUri,
        }),
      }),
    );
  });

  it('should build an Native Token TransferTransactionInfo', async () => {
    const chainId = faker.random.numeric();
    const transfer = nativeTokenTransferFactory();
    const safe = safeFactory();
    const addressInfo = new AddressInfo(faker.finance.ethereumAddress());
    const token = tokenFactory();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    tokenRepository.getToken.mockResolvedValue(token);

    const actual = await mapper.mapTransferInfo(chainId, transfer, safe);

    expect(actual).toBeInstanceOf(TransferTransactionInfo);
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
