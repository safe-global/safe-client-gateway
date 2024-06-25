import { Inject, Injectable } from '@nestjs/common';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { Transfer as DomainTransfer } from '@/domain/safe/entities/transfer.entity';
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
import { IConfigurationService } from '@/config/configuration.service.interface';
import { SwapTransferInfoMapper } from '@/routes/transactions/mappers/transfers/swap-transfer-info.mapper';

@Injectable()
export class TransferInfoMapper {
  private readonly isSwapsDecodingEnabled: boolean;
  private readonly isTwapsDecodingEnabled: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ITokenRepository) private readonly tokenRepository: TokenRepository,
    private readonly swapTransferInfoMapper: SwapTransferInfoMapper,
    private readonly addressInfoHelper: AddressInfoHelper,
  ) {
    this.isSwapsDecodingEnabled = this.configurationService.getOrThrow(
      'features.swapsDecoding',
    );
    this.isTwapsDecodingEnabled = this.configurationService.getOrThrow(
      'features.twapsDecoding',
    );
  }

  async mapTransferInfo(
    chainId: string,
    domainTransfer: DomainTransfer,
    safe: Safe,
  ): Promise<TransferTransactionInfo> {
    const { from, to } = domainTransfer;

    const [sender, recipient, transferInfo] = await Promise.all([
      this.addressInfoHelper.getOrDefault(chainId, from, ['TOKEN', 'CONTRACT']),
      this.addressInfoHelper.getOrDefault(chainId, to, ['TOKEN', 'CONTRACT']),
      this.getTransferByType(chainId, domainTransfer),
    ]);

    const direction = getTransferDirection(safe.address, from, to);

    if (this.isSwapsDecodingEnabled && this.isTwapsDecodingEnabled) {
      // If the transaction is a swap-based transfer, we return it immediately
      const swapTransfer =
        await this.swapTransferInfoMapper.mapSwapTransferInfo({
          sender,
          recipient,
          direction,
          transferInfo,
          chainId,
          safeAddress: safe.address,
          domainTransfer,
        });

      if (swapTransfer) {
        return swapTransfer;
      }
    }

    return new TransferTransactionInfo(
      sender,
      recipient,
      direction,
      transferInfo,
      null,
      null,
    );
  }

  private async getTransferByType(
    chainId: string,
    domainTransfer: DomainTransfer,
  ): Promise<Transfer> {
    if (domainTransfer.type === 'ERC20_TRANSFER') {
      const { tokenAddress, value } = domainTransfer;
      const token: Token | null = await this.getToken(
        chainId,
        tokenAddress,
      ).catch(() => null);
      return new Erc20Transfer(
        tokenAddress,
        value,
        token?.name,
        token?.symbol,
        token?.logoUri,
        token?.decimals,
        token?.trusted,
      );
    } else if (domainTransfer.type === 'ERC721_TRANSFER') {
      const { tokenAddress, tokenId } = domainTransfer;
      const token = await this.getToken(chainId, tokenAddress).catch(
        () => null,
      );
      return new Erc721Transfer(
        tokenAddress,
        tokenId,
        token?.name,
        token?.symbol,
        token?.logoUri,
        token?.trusted,
      );
    } else if (domainTransfer.type === 'ETHER_TRANSFER') {
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
