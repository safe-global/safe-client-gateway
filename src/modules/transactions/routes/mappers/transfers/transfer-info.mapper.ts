// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import type { Transfer as DomainTransfer } from '#/modules/safe/domain/entities/transfer.entity';
import type { Token } from '#/modules/tokens/domain/entities/token.entity';
import {
  type TransferDirection,
  TransferTransactionInfo,
} from '#/modules/transactions/routes/entities/transfer-transaction-info.entity';
import { Erc20Transfer } from '#/modules/transactions/routes/entities/transfers/erc20-transfer.entity';
import { Erc721Transfer } from '#/modules/transactions/routes/entities/transfers/erc721-transfer.entity';
import { NativeCoinTransfer } from '#/modules/transactions/routes/entities/transfers/native-coin-transfer.entity';
import type { Transfer } from '#/modules/transactions/routes/entities/transfers/transfer.entity';
import { getTransferDirection } from '#/modules/transactions/routes/mappers/common/transfer-direction.helper';
import { SwapTransferInfoMapper } from '#/modules/transactions/routes/mappers/transfers/swap-transfer-info.mapper';
import type { SwapTransferTransactionInfo } from '#/modules/transactions/routes/swap-transfer-transaction-info.entity';
import type { AddressLookups } from '#/routes/common/address-info/address-lookups';
import type { AddressInfo } from '#/routes/common/entities/address-info.entity';

@Injectable()
export class TransferInfoMapper {
  constructor(
    private readonly swapTransferInfoMapper: SwapTransferInfoMapper,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async mapTransferInfo(
    chainId: string,
    domainTransfer: DomainTransfer,
    safe: Safe,
    addressLookups: AddressLookups,
  ): Promise<SwapTransferTransactionInfo | TransferTransactionInfo> {
    const { from, to } = domainTransfer;

    const [sender, recipient, transferInfo] = await Promise.all([
      addressLookups.getOrDefault(from, ['TOKEN', 'CONTRACT']),
      addressLookups.getOrDefault(to, ['TOKEN', 'CONTRACT']),
      this.getTransferByType(domainTransfer, addressLookups),
    ]);

    const direction = getTransferDirection(safe.address, from, to);

    // If the transaction is a swap-based transfer, we return it immediately
    const swapTransfer = await this.mapSwapTransfer({
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

    return new TransferTransactionInfo(
      sender,
      recipient,
      direction,
      transferInfo,
      null,
    );
  }

  /**
   * Maps a swap transfer transaction.
   * If the transaction is not a swap transfer, it returns null.
   *
   * @param args.sender - {@link AddressInfo} sender of the transfer
   * @param args.recipient - {@link AddressInfo} recipient of the transfer
   * @param args.direction - {@link TransferDirection} of the transfer
   * @param args.chainId - chain id of the transfer
   * @param args.safeAddress - safe address of the transfer
   * @param args.transferInfo - {@link Transfer} info
   * @param args.domainTransfer - {@link DomainTransfer} domain transfer
   */
  private async mapSwapTransfer(args: {
    sender: AddressInfo;
    recipient: AddressInfo;
    direction: TransferDirection;
    chainId: string;
    safeAddress: Address;
    transferInfo: Transfer;
    domainTransfer: DomainTransfer;
  }): Promise<SwapTransferTransactionInfo | null> {
    try {
      return await this.swapTransferInfoMapper.mapSwapTransferInfo(args);
    } catch (error) {
      // There were either issues mapping the swap transfer or it is a "normal" transfer
      this.loggingService.debug(error);
      return null;
    }
  }

  private async getTransferByType(
    domainTransfer: DomainTransfer,
    addressLookups: AddressLookups,
  ): Promise<Transfer> {
    if (domainTransfer.type === 'ERC20_TRANSFER') {
      const { tokenAddress, value } = domainTransfer;
      const token = await this.getToken(tokenAddress, addressLookups).catch(
        () => null,
      );
      return new Erc20Transfer(
        tokenAddress,
        value,
        token?.name,
        token?.symbol,
        token?.logoUri,
        token?.decimals,
        token?.trusted,
      );
    }
    if (domainTransfer.type === 'ERC721_TRANSFER') {
      const { tokenAddress, tokenId } = domainTransfer;
      const token = await this.getToken(tokenAddress, addressLookups).catch(
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
    }
    if (domainTransfer.type === 'ETHER_TRANSFER') {
      return new NativeCoinTransfer(domainTransfer.value);
    }
    throw Error('Unknown transfer type');
  }

  private getToken(
    tokenAddress: Address | null,
    addressLookups: AddressLookups,
  ): Promise<Token> {
    if (!tokenAddress) {
      throw Error('Invalid token address for transfer');
    }
    return addressLookups.getToken(tokenAddress);
  }
}
