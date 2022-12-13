import { Inject, Injectable } from '@nestjs/common';
import { Keccak } from 'sha3';
import { Safe } from '../../../domain/safe/entities/safe.entity';
import {
  ERC20Transfer,
  ERC721Transfer,
  NativeTokenTransfer,
  Transfer,
} from '../../../domain/safe/entities/transfer.entity';
import { TokenRepository } from '../../../domain/tokens/token.repository';
import { ITokenRepository } from '../../../domain/tokens/token.repository.interface';
import { AddressInfoHelper } from '../../common/address-info/address-info.helper';
import { AddressInfo } from '../../common/entities/address-info.entity';
import { TransactionSummary } from '../entities/multisig-transaction.entity';
import { TransactionStatus } from '../entities/transaction-status.entity';
import {
  Erc20TransferInfo,
  Erc721TransferInfo,
  NativeCoinTransferInfo,
  TransferDirection,
  TransferTransaction,
} from '../entities/transfer-transaction.entity';

@Injectable()
export class IncomingTransferMapper {
  private static readonly ERC20_TRANSFER = 'ERC20_TRANSFER';
  private static readonly ERC721_TRANSFER = 'ERC721_TRANSFER';
  private static readonly ETHER_TRANSFER = 'ETHER_TRANSFER';

  constructor(
    private readonly addressInfoHelper: AddressInfoHelper,
    @Inject(ITokenRepository) private readonly tokenRepository: TokenRepository,
  ) {}

  async mapToTransactionSummary(
    chainId: string,
    transfer: Transfer,
    safe: Safe,
  ): Promise<TransactionSummary> {
    return <TransactionSummary>{
      id: `ethereum_${safe.address}_${
        transfer.transactionHash
      }_${this.hashTransfer(transfer)}`,
      timestamp: transfer.executionDate?.getTime(),
      txStatus: TransactionStatus.Success,
      executionInfo: null,
      safeAppInfo: null,
      txInfo: await this.mapTransactionInfo(chainId, transfer, safe),
    };
  }

  private mapTransactionInfo(
    chainId: string,
    transfer: Transfer,
    safe: Safe,
  ): Promise<TransferTransaction> {
    switch (transfer.type) {
      case IncomingTransferMapper.ERC20_TRANSFER:
        return this.mapErc20TransferTransaction(
          chainId,
          transfer as ERC20Transfer,
          safe,
        );
      case IncomingTransferMapper.ERC721_TRANSFER:
        return this.mapErc721TransferTransaction(
          chainId,
          transfer as ERC721Transfer,
          safe,
        );
      case IncomingTransferMapper.ETHER_TRANSFER:
        return this.mapEtherTransferTransaction(
          chainId,
          transfer as NativeTokenTransfer,
          safe,
        );
      default:
        throw Error('Unknown transfer type');
    }
  }

  private async mapErc20TransferTransaction(
    chainId: string,
    transfer: ERC20Transfer,
    safe: Safe,
  ): Promise<TransferTransaction> {
    const tokenAddress = transfer?.tokenAddress;
    if (!tokenAddress) {
      throw Error('Invalid token address for ERC20 transfer');
    }

    const token = await this.tokenRepository.getToken(chainId, tokenAddress);
    const senderAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      transfer.from,
    );
    const recipientAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      transfer.to,
    );

    return <TransferTransaction>{
      type: 'Transfer',
      sender: this.filterAddressInfo(senderAddressInfo),
      recipient: this.filterAddressInfo(recipientAddressInfo),
      direction: this.mapTransferDirection(
        safe.address,
        transfer.from,
        transfer.to,
      ),
      transferInfo: <Erc20TransferInfo>{
        type: 'ERC20',
        tokenAddress: token.address,
        tokenName: token.name,
        tokenSymbol: token.symbol,
        logoUri: token.logoUri,
        decimals: token.decimals,
        value: transfer.value,
      },
    };
  }

  private async mapErc721TransferTransaction(
    chainId: string,
    transfer: ERC721Transfer,
    safe: Safe,
  ): Promise<TransferTransaction> {
    const token = await this.tokenRepository.getToken(chainId, transfer.to);
    const senderAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      transfer.from,
    );
    const recipientAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      transfer.to,
    );

    return <TransferTransaction>{
      type: 'Transfer',
      sender: this.filterAddressInfo(senderAddressInfo),
      recipient: this.filterAddressInfo(recipientAddressInfo),
      direction: this.mapTransferDirection(
        safe.address,
        transfer.from,
        transfer.to,
      ),
      transferInfo: <Erc721TransferInfo>{
        type: 'ERC721',
        tokenAddress: token.address,
        tokenId: 'TODO',
        tokenName: token.name,
        tokenSymbol: token.symbol,
        logoUri: token.logoUri,
      },
    };
  }

  private async mapEtherTransferTransaction(
    chainId: string,
    transfer: NativeTokenTransfer,
    safe: Safe,
  ): Promise<TransferTransaction> {
    const senderAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      transfer.from,
    );
    const recipientAddressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      transfer.to,
    );

    const result = <TransferTransaction>{
      type: 'Transfer',
      sender: this.filterAddressInfo(senderAddressInfo),
      recipient: this.filterAddressInfo(recipientAddressInfo),
      direction: this.mapTransferDirection(
        safe.address,
        transfer.from,
        transfer.to,
      ),
      transferInfo: <NativeCoinTransferInfo>{
        type: 'NATIVE_COIN',
        value: transfer.value,
      },
    };

    return result;
  }

  // TODO: factorize
  private mapTransferDirection(safe: string, from: string, to: string): string {
    if (safe === from) {
      return TransferDirection[TransferDirection.Outgoing].toUpperCase();
    }
    if (safe === to) {
      return TransferDirection[TransferDirection.Incoming].toUpperCase();
    }
    return TransferDirection[TransferDirection.Unknown].toUpperCase();
  }

  //TODO: factorize
  private filterAddressInfo(addressInfo: AddressInfo): AddressInfo {
    return {
      value: addressInfo.value,
      name: addressInfo.name !== '' ? addressInfo.name : undefined,
      logoUri: addressInfo.logoUri,
    };
  }

  private hashTransfer(transfer: Transfer): string {
    const hash = new Keccak(256);
    switch (transfer.type) {
      case IncomingTransferMapper.ERC20_TRANSFER:
        {
          const { transactionHash, from, to, tokenAddress, value } =
            transfer as ERC20Transfer;
          hash.update(
            JSON.stringify({ transactionHash, from, to, tokenAddress, value }),
          );
        }
        break;
      case IncomingTransferMapper.ERC721_TRANSFER:
        {
          const { transactionHash, from, to, tokenAddress, tokenId } =
            transfer as ERC721Transfer;
          hash.update(
            JSON.stringify({
              transactionHash,
              from,
              to,
              tokenAddress,
              tokenId,
            }),
          );
        }
        break;
      case IncomingTransferMapper.ETHER_TRANSFER:
        {
          const { transactionHash, from, to, value } =
            transfer as ERC20Transfer;
          hash.update(JSON.stringify({ transactionHash, from, to, value }));
        }
        break;
      default:
        throw Error('Unknown transfer type');
    }
    return hash.digest('hex');
  }
}
