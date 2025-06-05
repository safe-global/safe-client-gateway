import { Inject, Injectable } from '@nestjs/common';
import { LiFiDecoder } from '@/domain/bridge/contracts/decoders/lifi-decoder.helper';
import { SwapTransactionInfo } from '@/routes/transactions/entities/bridge/bridge-info.entity';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { IBridgeRepository } from '@/domain/bridge/bridge.repository.interface';
import { BridgeStatus } from '@/domain/bridge/entities/bridge-status.entity';
import {
  BridgeName,
  isBridgeName,
} from '@/domain/bridge/entities/bridge-name.entity';
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
      args.executionDate
        ? this.getHistoricalInfo({
            ...decoded,
            chainId: args.chainId,
          })
        : this.getQueuedInfo({
            fromChain: args.chainId,
            toChain: decoded.toChain.toString(),
            fromAddress: args.safeAddress,
            fromAmount: decoded.fromAmount.toString(),
            fromToken: decoded.fromToken,
            fees: decoded.fees,
            bridge: isBridgeName(decoded.bridge) ? decoded.bridge : 'all',
          }),
    ]);

    return new BridgeAndSwapTransactionInfo({
      fromToken: new TokenInfo({
        ...fromToken,
        trusted: true,
      }),
      toToken: 'toToken' in info ? info.toToken : undefined,
      toAmount: 'toAmount' in info ? info.toAmount : undefined,
      recipient,
      fromAmount: decoded.fromAmount.toString(),
      toChain: decoded.toChain.toString(),
      ...info,
    });
  }

  private async getQueuedInfo(args: {
    fromChain: string;
    toChain: string;
    fromToken: `0x${string}`;
    fromAddress: `0x${string}`;
    fromAmount: string;
    bridge: BridgeName | 'all';
    fees: {
      tokenAddress: `0x${string}`;
      integratorFee: bigint;
      lifiFee: bigint;
      integratorAddress: `0x${string}`;
    } | null;
  }): Promise<{
    fees: {
      tokenAddress: Address;
      integratorFee: string;
      lifiFee: string;
    } | null;
    explorerUrl: null;
    status: BridgeStatus['status'] | 'AWAITING_EXECUTION';
    substatus: BridgeStatus['substatus'] | 'AWAITING_EXECUTION';
  }> {
    return Promise.resolve({
      fees: args.fees
        ? {
            tokenAddress: args.fees.tokenAddress,
            integratorFee: args.fees.integratorFee.toString(),
            lifiFee: args.fees.lifiFee.toString(),
          }
        : null,
      explorerUrl: null,
      status: 'AWAITING_EXECUTION',
      substatus: 'AWAITING_EXECUTION',
    });
  }

  private async getHistoricalInfo(args: {
    transactionId: `0x${string}`;
    fromAmount: bigint;
    chainId: string;
    fees: {
      tokenAddress: `0x${string}`;
      integratorFee: bigint;
      lifiFee: bigint;
      integratorAddress: `0x${string}`;
    } | null;
  }): Promise<{
    toAmount: string | undefined;
    fees: {
      tokenAddress: Address;
      integratorFee: string;
      lifiFee: string;
    } | null;
    explorerUrl: string | null;
    status: BridgeStatus['status'];
    toToken: TokenInfo | undefined;
    substatus: BridgeStatus['substatus'];
  }> {
    const status = await this.bridgeRepository.getStatus({
      txHash: args.transactionId,
      fromChain: args.chainId,
    });
    switch (status.status) {
      case 'DONE':
        return {
          toAmount: status.receiving.amount ?? '0',
          fees: args.fees
            ? {
                integratorFee: args.fees.integratorFee.toString(),
                lifiFee: args.fees.lifiFee.toString(),
                tokenAddress: args.fees.tokenAddress,
              }
            : null,
          status: status.status,
          toToken: status.receiving.token
            ? {
                address: status.receiving.token.address,
                decimals: status.receiving.token.decimals,
                logoUri: status.receiving.token.logoURI,
                name: status.receiving.token.name,
                symbol: status.receiving.token.symbol,
                trusted: true,
              }
            : undefined,
          explorerUrl: status.lifiExplorerLink,
          substatus: status.substatus,
        };
      case 'FAILED':
      case 'INVALID':
      case 'NOT_FOUND':
        return {
          toAmount: undefined,
          toToken: undefined,
          fees: args.fees
            ? {
                integratorFee: args.fees.integratorFee.toString(),
                lifiFee: args.fees.lifiFee.toString(),
                tokenAddress: args.fees.tokenAddress,
              }
            : null,
          explorerUrl: null,
          status: status.status,
          substatus: status.substatus,
        };
      case 'PENDING':
        return {
          toAmount: undefined,
          toToken: undefined,
          fees: null,
          explorerUrl: null,
          status: status.status,
          substatus: status.substatus,
        };
    }
  }
}
