import { Inject, Injectable } from '@nestjs/common';
import { Transfer as DomainTransfer } from '@/domain/safe/entities/transfer.entity';
import { TransferDirection } from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { Transfer } from '@/routes/transactions/entities/transfers/transfer.entity';
import { GPv2OrderHelper } from '@/routes/transactions/helpers/gp-v2-order.helper';
import { SwapOrderHelper } from '@/routes/transactions/helpers/swap-order.helper';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { SwapTransferTransactionInfo } from '@/routes/transactions/swap-transfer-transaction-info.entity';
import { getAddress, isAddressEqual } from 'viem';
import { ISwapsRepository } from '@/domain/swaps/swaps.repository';

@Injectable()
export class SwapTransferInfoMapper {
  constructor(
    private readonly swapOrderHelper: SwapOrderHelper,
    @Inject(ISwapsRepository)
    private readonly swapsRepository: ISwapsRepository,
  ) {}

  public async mapSwapTransferInfo(args: {
    sender: AddressInfo;
    recipient: AddressInfo;
    direction: TransferDirection;
    chainId: string;
    safeAddress: `0x${string}`;
    transferInfo: Transfer;
    domainTransfer: DomainTransfer;
  }): Promise<SwapTransferTransactionInfo | null> {
    if (
      !this.isSettlement(args.sender.value) &&
      !this.isSettlement(args.recipient.value)
    ) {
      return null;
    }

    // TODO: Handle orders that may have been executed within the same transaction
    // by finding matching domainTransfer in orders
    const [order] = await this.swapsRepository.getOrders(
      args.chainId,
      args.domainTransfer.transactionHash,
    );

    const [sellToken, buyToken] = await Promise.all([
      this.swapOrderHelper.getToken({
        address: order.sellToken,
        chainId: args.chainId,
      }),
      this.swapOrderHelper.getToken({
        address: order.buyToken,
        chainId: args.chainId,
      }),
    ]);

    return new SwapTransferTransactionInfo({
      // TransferTransactionInfo
      sender: args.sender,
      recipient: args.recipient,
      direction: args.direction,
      transferInfo: args.transferInfo,
      humanDescription: null,
      richDecodedInfo: null,
      // SwapOrderTransactionInfo
      uid: order.uid,
      orderStatus: order.status,
      kind: order.kind,
      class: order.class,
      validUntil: order.validTo,
      sellAmount: order.sellAmount.toString(),
      buyAmount: order.buyAmount.toString(),
      executedSellAmount: order.executedSellAmount.toString(),
      executedBuyAmount: order.executedBuyAmount.toString(),
      sellToken,
      buyToken,
      explorerUrl: this.swapOrderHelper.getOrderExplorerUrl(order).toString(),
      executedSurplusFee: order.executedSurplusFee?.toString() ?? null,
      receiver: order.receiver,
      owner: order.owner,
      fullAppData: order.fullAppData,
    });
  }

  private isSettlement(address: string): boolean {
    return isAddressEqual(
      getAddress(address),
      GPv2OrderHelper.SettlementContractAddress,
    );
  }
}
