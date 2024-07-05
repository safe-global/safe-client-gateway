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
import { Order } from '@/domain/swaps/entities/order.entity';

@Injectable()
export class SwapTransferInfoMapper {
  constructor(
    private readonly swapOrderHelper: SwapOrderHelper,
    @Inject(ISwapsRepository)
    private readonly swapsRepository: ISwapsRepository,
  ) {}

  /**
   * Maps a swap transfer transaction info
   *
   * @param args.sender - {@link AddrssInfo} sender of the transfer
   * @param args.recipient - {@link AddrssInfo} recipient of the transfer
   * @param args.direction - {@link TransferDirection} direction of the transfer
   * @param args.chainId - chain id of the transfer
   * @param args.safeAddress - safe address of the transfer
   * @param args.transferInfo - {@link TransferInfo} transfer info
   * @param args.domainTransfer - {@link Transfer} domain transfer (used to find the order)
   * @returns
   */
  public async mapSwapTransferInfo(args: {
    sender: AddressInfo;
    recipient: AddressInfo;
    direction: TransferDirection;
    chainId: string;
    safeAddress: `0x${string}`;
    transferInfo: Transfer;
    domainTransfer: DomainTransfer;
  }): Promise<SwapTransferTransactionInfo | null> {
    // If settlement contract is not interacted with, not a swap fulfillment
    if (
      !this.isSettlement(args.sender.value) &&
      !this.isSettlement(args.recipient.value)
    ) {
      return null;
    }

    const orders = await this.swapsRepository.getOrders(
      args.chainId,
      args.domainTransfer.transactionHash,
    );

    // One transaction may contain multiple orders
    const order = this.findOrderByTransfer(orders, args.domainTransfer);

    if (!order) {
      return null;
    }

    // TODO: Refactor with confirmation view, swaps and TWAPs
    if (!this.swapOrderHelper.isAppAllowed(order)) {
      throw new Error(`Unsupported App: ${order.fullAppData?.appCode}`);
    }

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

  /**
   * Finds a order by transfer by comparing the token address and value of the transfer
   * with the order's sellToken and buyToken.
   *
   * @param orders
   * @param transfer
   * @returns the {@link Order} if found, otherwise `undefined`
   */
  private findOrderByTransfer(
    orders: Array<Order>,
    transfer: DomainTransfer,
  ): Order | undefined {
    return orders.find((order) => {
      if (transfer.type === 'ERC721_TRANSFER') {
        throw new Error('ERC721 transfers are not supported by swaps');
      }

      const isSender = transfer.from === order.owner;

      const isValue = isSender
        ? transfer.value === order.executedSellAmount.toString()
        : transfer.value === order.executedBuyAmount.toString();

      const isToken = ((): boolean => {
        const tokenToCompare = isSender ? order.sellToken : order.buyToken;

        if (transfer.type === 'ETHER_TRANSFER') {
          return tokenToCompare === SwapOrderHelper.NATIVE_CURRENCY_ADDRESS;
        }
        if (transfer.type === 'ERC20_TRANSFER') {
          return tokenToCompare === transfer.tokenAddress;
        }

        return false;
      })();

      return isValue && isToken;
    });
  }
}
