import { Inject, Injectable } from '@nestjs/common';
import { LiFiDecoder } from '@/domain/bridge/contracts/decoders/lifi-decoder.helper';
import { SwapTransactionInfo } from '@/routes/transactions/entities/bridge/bridge-info.entity';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { IBridgeRepository } from '@/domain/bridge/bridge.repository.interface';
import { BridgeStatus } from '@/domain/bridge/entities/bridge-status.entity';
import { Address } from 'viem';
import { BridgeAndSwapTransactionInfo } from '@/routes/transactions/entities/bridge/bridge-info.entity';

@Injectable()
export class BridgeTransactionMapper {
  constructor(
    private readonly liFiDecoder: LiFiDecoder,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
    private readonly addressInfoHelper: AddressInfoHelper,
    @Inject(IBridgeRepository)
    private readonly bridgeRepository: IBridgeRepository,
  ) {}

  // TODO:
  public mapSwap(data: `0x${string}`): SwapTransactionInfo {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const decoded = this.liFiDecoder.decodeSwap(data);

    return new SwapTransactionInfo();
  }

  public async mapSwapAndBridge(args: {
    chainId: string;
    data: `0x${string}`;
    executionDate: Date | null;
    safeAddress: `0x${string}`;
  }): Promise<BridgeAndSwapTransactionInfo | null> {
    const decoded = this.liFiDecoder.decodeBridgeAndMaybeSwap(args.data);

    const [fromToken, recipient, info] = await Promise.all([
      this.tokenRepository.getToken({
        address: decoded.fromToken,
        chainId: args.chainId,
      }),
      this.addressInfoHelper.getOrDefault(args.chainId, decoded.toAddress, [
        'CONTRACT',
      ]),
      this.getSwapAndBridgeInfo({
        ...args,
        decoded,
      }),
    ]);

    return new BridgeAndSwapTransactionInfo({
      fromToken: new TokenInfo({
        ...fromToken,
        trusted: true,
      }),
      recipient,
      fromAmount: decoded.fromAmount.toString(),
      toChain: decoded.toChain.toString(),
      ...info,
    });
  }

  private async getSwapAndBridgeInfo(args: {
    executionDate: Date | null;
    chainId: string;
    safeAddress: `0x${string}`;
    decoded: ReturnType<LiFiDecoder['decodeBridgeAndMaybeSwap']>;
  }): Promise<{
    toAmount: string | null;
    fees: {
      tokenAddress: Address;
      integratorFee: string;
      lifiFee: string;
    } | null;
    status: BridgeStatus['status'] | 'AWAITING_EXECUTION';
    substatus: BridgeStatus['substatus'] | 'AWAITING_EXECUTION';
    toToken: TokenInfo | null;
    explorerUrl: string | null;
  }> {
    if (!args.executionDate) {
      return Promise.resolve({
        toAmount: null,
        fees: args.decoded.fees
          ? {
              tokenAddress: args.decoded.fees.tokenAddress,
              integratorFee: args.decoded.fees.integratorFee.toString(),
              lifiFee: args.decoded.fees.lifiFee.toString(),
            }
          : null,
        explorerUrl: null,
        toToken: null,
        status: 'AWAITING_EXECUTION',
        substatus: 'AWAITING_EXECUTION',
      });
    }

    const status = await this.bridgeRepository.getStatus({
      txHash: args.decoded.transactionId,
      fromChain: args.chainId,
    });

    switch (status.status) {
      case 'DONE':
        return {
          toAmount: status.receiving.amount ?? '0',
          fees: args.decoded.fees
            ? {
                integratorFee: args.decoded.fees.integratorFee.toString(),
                lifiFee: args.decoded.fees.lifiFee.toString(),
                tokenAddress: args.decoded.fees.tokenAddress,
              }
            : null,
          status: status.status,
          toToken: status.receiving.token
            ? new TokenInfo({
                address: status.receiving.token.address,
                decimals: status.receiving.token.decimals,
                logoUri: status.receiving.token.logoURI,
                name: status.receiving.token.name,
                symbol: status.receiving.token.symbol,
                trusted: true,
              })
            : null,
          explorerUrl: status.lifiExplorerLink,
          substatus: status.substatus,
        };
      case 'FAILED':
      case 'INVALID':
      case 'NOT_FOUND':
        return {
          toAmount: null,
          toToken: null,
          fees: args.decoded.fees
            ? {
                integratorFee: args.decoded.fees.integratorFee.toString(),
                lifiFee: args.decoded.fees.lifiFee.toString(),
                tokenAddress: args.decoded.fees.tokenAddress,
              }
            : null,
          explorerUrl: null,
          status: status.status,
          substatus: status.substatus,
        };
      case 'PENDING':
        return {
          toAmount: null,
          toToken: null,
          fees: null,
          explorerUrl: null,
          status: status.status,
          substatus: status.substatus,
        };
    }
  }
}
