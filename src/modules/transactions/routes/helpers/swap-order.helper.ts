// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable, Module } from '@nestjs/common';
import {
  type Address,
  decodeFunctionData,
  erc20Abi,
  type Hex,
  isAddressEqual,
  size,
  slice,
  toFunctionSelector,
} from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { getAllMultiSendDeployments } from '#/domain/common/utils/deployments';
import { ChainsModule } from '#/modules/chains/chains.module';
import { IChainsRepository } from '#/modules/chains/domain/chains.repository.interface';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import { GPv2Decoder } from '#/modules/swaps/domain/contracts/decoders/gp-v2-decoder.helper';
import {
  type KnownOrder,
  type Order,
  OrderKind,
} from '#/modules/swaps/domain/entities/order.entity';
import { ISwapsRepository } from '#/modules/swaps/domain/swaps.repository';
import { SwapsModule } from '#/modules/swaps/swaps.module';
import type { Token } from '#/modules/tokens/domain/entities/token.entity';
import { ITokenRepository } from '#/modules/tokens/domain/token.repository.interface';
import { TokensModule } from '#/modules/tokens/tokens.module';
import { GPv2OrderHelper } from '#/modules/transactions/routes/helpers/gp-v2-order.helper';

type Call = {
  operation: Operation;
  to: Address;
  value: bigint;
  data: Hex;
};

/**
 * The calls of a transaction that only places a swap order: its presignature,
 * plus approvals and wraps that still have to be checked against the order.
 */
export type SwapOrderCalls = {
  preSignature: Hex;
  approvedTokens: Array<Address>;
  wraps: Array<{ token: Address; value: bigint }>;
};

@Injectable()
export class SwapOrderHelper {
  // This is the Native Currency address considered by CoW Swap
  // https://docs.cow.fi/cow-protocol/reference/sdks/cow-sdk/modules#buy_eth_address
  public static readonly NATIVE_CURRENCY_ADDRESS =
    '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

  private readonly swapsExplorerBaseUri: string;

  // Order UID = order digest (32 bytes) + owner (20 bytes) + validTo (4 bytes)
  private static readonly ORDER_UID_SIZE = 56;
  private static readonly ORDER_UID_OWNER_OFFSET = 32;
  private static readonly ORDER_UID_OWNER_END = 52;
  private static readonly ApproveSelector = toFunctionSelector(
    'function approve(address spender, uint256 value)',
  );
  private static readonly WrapSelector =
    toFunctionSelector('function deposit()');

  constructor(
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly gpv2Decoder: GPv2Decoder,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
    @Inject(ISwapsRepository)
    private readonly swapsRepository: ISwapsRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
  ) {
    this.swapsExplorerBaseUri = this.configurationService.getOrThrow(
      'swaps.explorerBaseUri',
    );
  }

  /**
   * Finds the calls of a transaction that only places a CoW swap order.
   *
   * The transaction is either the presignature itself, or a batch sent with
   * DELEGATECALL to an official MultiSend deployment. The batch must contain
   * exactly one presignature, and otherwise only approvals to the VaultRelayer
   * and wraps (WETH `deposit()`), whose tokens and amounts the caller checks
   * against the order.
   * The presignature is a CALL without value to the Settlement contract that
   * signs an order owned by the Safe.
   *
   * @param args.chainId - chain of the transaction
   * @param args.safeAddress - Safe executing the transaction
   * @param args.transaction - the transaction to inspect
   * @returns the order calls, or null if the transaction does anything else
   */
  public findSwapOrder(args: {
    chainId: string;
    safeAddress: Address;
    transaction: {
      to: Address;
      value: string | null;
      data: Hex;
      operation: Operation;
    };
  }): SwapOrderCalls | null {
    const calls = this.getCalls(args);
    if (!calls) {
      return null;
    }

    const preSignatures = calls.filter((call) =>
      this.gpv2Decoder.helpers.isSetPreSignature(call.data),
    );
    if (preSignatures.length !== 1) {
      return null;
    }

    const [preSignature] = preSignatures;
    if (!this.isOwnPreSignature(preSignature, args.safeAddress)) {
      return null;
    }

    const orderCalls: SwapOrderCalls = {
      preSignature: preSignature.data,
      approvedTokens: [],
      wraps: [],
    };

    for (const call of calls) {
      if (call === preSignature) {
        continue;
      }
      if (call.operation !== Operation.CALL) {
        return null;
      }

      if (this.isApprovalToVaultRelayer(call)) {
        orderCalls.approvedTokens.push(call.to);
        continue;
      }

      if (call.data.toLowerCase() === SwapOrderHelper.WrapSelector) {
        orderCalls.wraps.push({ token: call.to, value: call.value });
        continue;
      }

      return null;
    }

    return orderCalls;
  }

  private getCalls(args: {
    chainId: string;
    transaction: {
      to: Address;
      value: string | null;
      data: Hex;
      operation: Operation;
    };
  }): Array<Call> | null {
    const { to, value, data, operation } = args.transaction;

    if (!this.multiSendDecoder.helpers.isMultiSend(data)) {
      return [{ operation, to, value: BigInt(value ?? 0), data }];
    }

    const isOfficialMultiSend = getAllMultiSendDeployments({
      chainId: args.chainId,
    }).some((multiSend) => isAddressEqual(multiSend, to));
    if (operation !== Operation.DELEGATE || !isOfficialMultiSend) {
      return null;
    }

    const calls = this.multiSendDecoder.mapMultiSendTransactions(data);
    return calls.length > 0 ? calls : null;
  }

  private isOwnPreSignature(call: Call, safeAddress: Address): boolean {
    if (
      call.operation !== Operation.CALL ||
      call.value !== BigInt(0) ||
      !isAddressEqual(call.to, GPv2OrderHelper.SettlementContractAddress)
    ) {
      return false;
    }

    const preSignature = this.gpv2Decoder.decodePreSignature(call.data);
    if (
      !preSignature?.signed ||
      size(preSignature.orderUid) !== SwapOrderHelper.ORDER_UID_SIZE
    ) {
      return false;
    }

    const owner = slice(
      preSignature.orderUid,
      SwapOrderHelper.ORDER_UID_OWNER_OFFSET,
      SwapOrderHelper.ORDER_UID_OWNER_END,
    );
    return isAddressEqual(owner, safeAddress);
  }

  private isApprovalToVaultRelayer(call: Call): boolean {
    if (
      call.value !== BigInt(0) ||
      call.data.slice(0, 10).toLowerCase() !== SwapOrderHelper.ApproveSelector
    ) {
      return false;
    }
    try {
      const { functionName, args } = decodeFunctionData({
        abi: erc20Abi,
        data: call.data,
      });
      return (
        functionName === 'approve' &&
        isAddressEqual(args[0], GPv2OrderHelper.VaultRelayerAddress)
      );
    } catch {
      return false;
    }
  }

  /**
   * Retrieves detailed information about a specific order and its associated tokens
   *
   * @param {Object} args - The arguments required to fetch the order.
   * @param {string} args.chainId - The network chain ID.
   * @param {string} args.orderUid - The unique identifier of the order, prefixed with '0x'.
   * @returns {Promise} A promise that resolves to an object containing the order and token details.
   *
   * The returned object represents the order.
   *
   * @throws {Error} Throws an error if the order `kind` is 'unknown'.
   * @throws {Error} Throws an error if either the sellToken or buyToken object has null decimals.
   */
  async getOrder(args: {
    chainId: string;
    orderUid: Address;
  }): Promise<KnownOrder> {
    const order = await this.swapsRepository.getOrder(
      args.chainId,
      args.orderUid,
    );

    if (order.kind === OrderKind.Unknown) {
      throw new Error('Unknown order kind');
    }

    return {
      ...order,
      kind: order.kind,
    };
  }

  /**
   * Returns the URL to the explorer page of an order.
   *
   * @param order - The order to get the explorer URL for.
   * @private
   */
  getOrderExplorerUrl(order: Order): URL {
    const url = new URL(this.swapsExplorerBaseUri);
    url.pathname = `/orders/${order.uid}`;
    return url;
  }

  /**
   * Retrieves a token object based on the provided Ethereum chain ID and token address.
   * If the specified address is the placeholder for the native currency of the chain,
   * it fetches the chain's native currency details from the {@link IChainsRepository}.
   * Otherwise, it fetches the token details from the {@link ITokenRepository}.
   *
   * @param args An object containing:
   *   - `chainId`: A string representing the ID of the blockchain chain.
   *   - `address`: A string representing the Ethereum address of the token, prefixed with '0x'.
   * @returns {Promise<Token>} A promise that resolves to a Token object containing the details
   * of either the native currency or the specified token with mandatory decimals.
   * @throws {Error} Throws an error if the token data cannot be retrieved.
   * @async
   */
  public async getToken(args: {
    chainId: string;
    address: Address;
  }): Promise<Token> {
    // We perform lower case comparison because the provided address (3rd party service)
    // might not be checksummed.
    if (
      args.address.toLowerCase() ===
      SwapOrderHelper.NATIVE_CURRENCY_ADDRESS.toLowerCase()
    ) {
      const { nativeCurrency } = await this.chainsRepository.getChain(
        args.chainId,
      );
      return {
        address: SwapOrderHelper.NATIVE_CURRENCY_ADDRESS,
        decimals: nativeCurrency.decimals,
        logoUri: nativeCurrency.logoUri,
        name: nativeCurrency.name,
        symbol: nativeCurrency.symbol,
        type: 'NATIVE_TOKEN',
        trusted: true,
      };
    }
    return await this.tokenRepository.getToken({
      chainId: args.chainId,
      address: args.address,
    });
  }
}

@Module({
  imports: [ChainsModule, SwapsModule, TokensModule],
  providers: [SwapOrderHelper, GPv2Decoder, MultiSendDecoder],
  exports: [SwapOrderHelper],
})
export class SwapOrderHelperModule {}
