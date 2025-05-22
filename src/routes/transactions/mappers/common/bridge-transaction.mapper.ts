import { Inject, Injectable } from '@nestjs/common';
import { LiFiDecoder } from '@/domain/bridge/contracts/decoders/lifi-decoder.helper';
import {
  BridgeTransactionInfo,
  SwapAndBridgeTransactionInfo,
  SwapTransactionInfo,
} from '@/routes/transactions/entities/bridge/bridge-info.entity';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { IBridgeRepository } from '@/domain/bridge/bridge.repository.interface';
import { BridgeStatus } from '@/domain/bridge/entities/bridge-status.entity';
import {
  BridgeName,
  isBridgeName,
} from '@/domain/bridge/entities/bridge-name.entity';

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
  public mapBridge(data: `0x${string}`): BridgeTransactionInfo | null {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const decoded = this.liFiDecoder.decodeBridgeAndMaybeSwap(data);

    return new BridgeTransactionInfo();
  }

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
  }): Promise<SwapAndBridgeTransactionInfo | null> {
    const decoded = this.liFiDecoder.decodeBridgeAndMaybeSwap(args.data);

    const [fromToken, toToken, recipient, info] = await Promise.all([
      this.tokenRepository.getToken({
        address: decoded.fromToken,
        chainId: args.chainId,
      }),
      this.tokenRepository.getToken({
        address: decoded.toToken,
        chainId: args.chainId,
      }),
      this.addressInfoHelper.getOrDefault(args.chainId, decoded.toAddress, [
        'TOKEN',
        'CONTRACT',
      ]),
      args.executionDate
        ? this.getHistoricalInfo({
            ...decoded,
            chainId: args.chainId,
          })
        : this.getQueuedInfo({
            fromChain: args.chainId,
            toChain: args.chainId,
            fromAddress: args.safeAddress,
            fromAmount: decoded.fromAmount.toString(),
            fromToken: decoded.fromToken,
            toToken: decoded.toToken,
            bridge: isBridgeName(decoded.bridge) ? decoded.bridge : 'all',
          }),
    ]);

    return new SwapAndBridgeTransactionInfo({
      fromToken: new TokenInfo({
        ...fromToken,
        trusted: true,
      }),
      toToken: new TokenInfo({
        ...toToken,
        trusted: true,
      }),
      recipient,
      fromAmount: decoded.fromAmount.toString(),
      ...info,
    });
  }

  private async getQueuedInfo(args: {
    fromChain: string;
    toChain: string;
    fromToken: `0x${string}`;
    toToken: `0x${string}`;
    fromAddress: `0x${string}`;
    fromAmount: string;
    bridge: BridgeName | 'all';
  }): Promise<{
    exchangeRate: number;
    maxSlippage: number;
    toAmount: string;
    fee: number;
    explorerUrl: null;
    status: BridgeStatus['status'];
  }> {
    const [route] = await this.bridgeRepository.getRoutes({
      fromChainId: args.fromChain,
      fromAmount: args.fromAmount,
      fromTokenAddress: args.fromToken,
      fromAddress: args.fromAddress,
      toChainId: args.toChain,
      toTokenAddress: args.toToken,
      options: {
        bridges: {
          allow: [args.bridge],
        },
      },
    });

    const exchangeRate = Number(route.toAmount) / Number(args.fromAmount);

    return Promise.resolve({
      exchangeRate,
      toAmount: route.toAmount,
      fee: -1, // TODO:
      explorerUrl: null,
      status: 'PENDING', // TODO: Add awaiting execution status
      maxSlippage: -1, // TODO:
    });
  }

  private async getHistoricalInfo(args: {
    transactionId: `0x${string}`;
    fromAmount: bigint;
    chainId: string;
  }): Promise<{
    exchangeRate: number;
    toAmount: string;
    fee: number;
    explorerUrl: string | null;
    status: BridgeStatus['status'];
    maxSlippage: number;
  }> {
    const status = await this.bridgeRepository.getStatus({
      txHash: args.transactionId,
      fromChain: args.chainId,
    });

    const includedSteps =
      status && 'includedSteps' in status.sending
        ? (status.sending.includedSteps ?? [])
        : [];
    const toAmount = includedSteps[includedSteps.length - 1].toAmount;
    const exchangeRate = Number(toAmount) / Number(args.fromAmount);

    const explorerUrl =
      status && 'lifiExplorerLink' in status ? status.lifiExplorerLink : null;

    const feeCollectionStep = includedSteps.find(({ tool }) => {
      return tool === 'feeCollection';
    });

    // TODO: Look into maybe using feeCosts from FullStatusDataSchema
    //       and maybe need to format token values
    const fee = feeCollectionStep
      ? // TODO: Format token values
        Number(feeCollectionStep.fromAmount) -
        Number(feeCollectionStep.toAmount)
      : 0;

    return {
      exchangeRate,
      toAmount,
      fee,
      explorerUrl,
      status: status.status,
      maxSlippage: -1, // TODO:
    };
  }
}
