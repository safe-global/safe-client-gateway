import { Inject, Injectable } from '@nestjs/common';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import {
  ERC20Transfer,
  ERC721Transfer,
  NativeTokenTransfer,
  Transfer as DomainTransfer,
} from '../../../../domain/safe/entities/transfer.entity';
import { Token } from '../../../../domain/tokens/entities/token.entity';
import { TokenRepository } from '../../../../domain/tokens/token.repository';
import { ITokenRepository } from '../../../../domain/tokens/token.repository.interface';
import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import { TransferTransactionInfo } from '../../entities/transfer-transaction-info.entity';
import { Erc20Transfer } from '../../entities/transfers/erc20-transfer.entity';
import { Erc721Transfer } from '../../entities/transfers/erc721-transfer.entity';
import { NativeCoinTransfer } from '../../entities/transfers/native-coin-transfer.entity';
import { Transfer } from '../../entities/transfers/transfer.entity';
import { getTransferDirection } from '../common/transfer-direction.helper';

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
  ): Promise<TransferTransactionInfo> {
    const { from, to, type } = domainTransfer;
    const sender = await this.addressInfoHelper.getOrDefault(chainId, from);
    const recipient = await this.addressInfoHelper.getOrDefault(chainId, to);
    const direction = getTransferDirection(safe.address, from, to);

    return new TransferTransactionInfo(
      sender,
      recipient,
      direction,
      await this.getTransferByType(chainId, domainTransfer, type),
    );
  }

  private async getTransferByType(
    chainId: string,
    domainTransfer: DomainTransfer,
    type: string,
  ): Promise<Transfer> {
    let transfer: Transfer;

    switch (type) {
      case TransferInfoMapper.ERC20_TRANSFER: {
        const { tokenAddress, value } = domainTransfer as ERC20Transfer;
        const token = await this.getToken(chainId, tokenAddress);
        transfer = new Erc20Transfer(
          token.address,
          value,
          token.name,
          token.symbol,
          token.logoUri,
          token.decimals,
        );
        break;
      }

      case TransferInfoMapper.ERC721_TRANSFER: {
        const { tokenAddress, tokenId } = domainTransfer as ERC721Transfer;
        const token = await this.getToken(chainId, tokenAddress);
        transfer = new Erc721Transfer(
          token.address,
          tokenId,
          token.name,
          token.symbol,
          token.logoUri,
        );
        break;
      }

      case TransferInfoMapper.ETHER_TRANSFER: {
        const nativeCoinTransfer = domainTransfer as NativeTokenTransfer;
        transfer = new NativeCoinTransfer(nativeCoinTransfer.value);
        break;
      }

      default:
        throw Error('Unknown transfer type');
    }

    return transfer;
  }

  private getToken(
    chainId: string,
    tokenAddress: string | null,
  ): Promise<Token> {
    if (!tokenAddress) {
      throw Error('Invalid token address for transfer');
    }
    return this.tokenRepository.getToken(chainId, tokenAddress);
  }
}
