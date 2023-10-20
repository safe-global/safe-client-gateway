import { Inject, Injectable } from '@nestjs/common';
import { Safe } from '@/domain/safe/entities/safe.entity';
import {
  isERC20Transfer,
  isERC721Transfer,
  isNativeTokenTransfer,
  Transfer as DomainTransfer,
} from '@/domain/safe/entities/transfer.entity';
import { Token } from '@/domain/tokens/entities/token.entity';
import { TokenRepository } from '@/domain/tokens/token.repository';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { TransferTransactionInfo } from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { Erc20Transfer } from '@/routes/transactions/entities/transfers/erc20-transfer.entity';
import { Erc721Transfer } from '@/routes/transactions/entities/transfers/erc721-transfer.entity';
import { NativeCoinTransfer } from '@/routes/transactions/entities/transfers/native-coin-transfer.entity';
import { getTransferDirection } from '@/routes/transactions/mappers/common/transfer-direction.helper';
import { Transfer } from '@/routes/transactions/entities/transfers/transfer.entity';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';

@Injectable()
export class TransferInfoMapper {
  private static readonly ERC20_TRANSFER = 'ERC20_TRANSFER';
  private static readonly ERC721_TRANSFER = 'ERC721_TRANSFER';
  private static readonly ETHER_TRANSFER = 'ETHER_TRANSFER';

  constructor(
    @Inject(ITokenRepository) private readonly tokenRepository: TokenRepository,
    private readonly addressInfoHelper: AddressInfoHelper,
  ) {}

  async mapTransferInfo(
    chainId: string,
    domainTransfer: DomainTransfer,
    safe: Safe,
    resolveAddressInfo = true,
  ): Promise<TransferTransactionInfo> {
    const { from, to } = domainTransfer;
    const sender = resolveAddressInfo
      ? await this.addressInfoHelper.getOrDefault(chainId, from, [
          'TOKEN',
          'CONTRACT',
        ])
      : new AddressInfo(from);

    const recipient = resolveAddressInfo
      ? await this.addressInfoHelper.getOrDefault(chainId, to, [
          'TOKEN',
          'CONTRACT',
        ])
      : new AddressInfo(to);

    const direction = getTransferDirection(safe.address, from, to);

    return new TransferTransactionInfo(
      sender,
      recipient,
      direction,
      await this.getTransferByType(chainId, domainTransfer, resolveAddressInfo),
      null,
      null,
    );
  }

  private async getTransferByType(
    chainId: string,
    domainTransfer: DomainTransfer,
    resolveAddressInfo = true,
  ): Promise<Transfer> {
    if (isERC20Transfer(domainTransfer)) {
      const { tokenAddress, value } = domainTransfer;
      const token = resolveAddressInfo
        ? await this.getToken(chainId, tokenAddress).catch(() => null)
        : null;
      return new Erc20Transfer(
        tokenAddress,
        value,
        token?.name,
        token?.symbol,
        token?.logoUri,
        token?.decimals,
      );
    } else if (isERC721Transfer(domainTransfer)) {
      const { tokenAddress, tokenId } = domainTransfer;
      const token = resolveAddressInfo
        ? await this.getToken(chainId, tokenAddress).catch(() => null)
        : null;
      return new Erc721Transfer(
        tokenAddress,
        tokenId,
        token?.name,
        token?.symbol,
        token?.logoUri,
      );
    } else if (isNativeTokenTransfer(domainTransfer)) {
      return new NativeCoinTransfer(domainTransfer.value);
    } else {
      throw Error('Unknown transfer type');
    }
  }

  private getToken(
    chainId: string,
    tokenAddress: string | null,
  ): Promise<Token> {
    if (!tokenAddress) {
      throw Error('Invalid token address for transfer');
    }
    return this.tokenRepository.getToken({ chainId, address: tokenAddress });
  }
}
