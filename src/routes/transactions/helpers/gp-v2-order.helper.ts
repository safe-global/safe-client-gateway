import { GPv2OrderParameters } from '@/domain/swaps/contracts/decoders/gp-v2-decoder.helper';
import { Injectable } from '@nestjs/common';
import { TypedDataDomain, encodePacked, hashTypedData } from 'viem';

@Injectable()
export class GPv2OrderHelper {
  public static readonly SettlementContractAddress =
    '0x9008D19f58AAbD9eD0D60971565AA8510560ab41' as const;

  // Domain
  private static readonly DomainName = 'Gnosis Protocol' as const;
  private static readonly DomainVersion = 'v2' as const;

  // Typed data
  private static readonly TypedDataPrimaryType = 'Order' as const;
  private static readonly TypedDataTypes = {
    [GPv2OrderHelper.TypedDataPrimaryType]: [
      { name: 'sellToken', type: 'address' },
      { name: 'buyToken', type: 'address' },
      { name: 'receiver', type: 'address' },
      { name: 'sellAmount', type: 'uint256' },
      { name: 'buyAmount', type: 'uint256' },
      { name: 'validTo', type: 'uint32' },
      { name: 'appData', type: 'bytes32' },
      { name: 'feeAmount', type: 'uint256' },
      { name: 'kind', type: 'string' },
      { name: 'partiallyFillable', type: 'bool' },
      { name: 'sellTokenBalance', type: 'string' },
      { name: 'buyTokenBalance', type: 'string' },
    ],
  } as const;

  /**
   * Computes the order UID from the given order parameters
   *
   * @param args.chainId - chain order is on
   * @param args.owner - owner of the order
   * @param args.order - order parameters
   * @returns order UID
   *
   * Implementation taken from CoW Protocol
   * @see https://github.com/cowprotocol/contracts/blob/1465e69f6935b3ef9ce45d4878e44f0335ef8531/src/ts/order.ts#L311
   */
  public computeOrderUid(args: {
    chainId: string;
    owner: `0x${string}`;
    order: GPv2OrderParameters;
  }): `0x${string}` {
    return encodePacked(
      ['bytes32', 'address', 'uint32'],
      [this.hashOrder(args), args.owner, args.order.validTo],
    );
  }

  /**
   * Computes the 32-byte signing hash of an order
   *
   * @param args.chain - chain order is on
   * @param args.order - order parameters
   * @returns order hash
   *
   * Implementation taken from CoW Protocol
   * @see https://github.com/cowprotocol/contracts/blob/1465e69f6935b3ef9ce45d4878e44f0335ef8531/src/ts/order.ts#L277
   */
  private hashOrder(args: {
    chainId: string;
    order: GPv2OrderParameters;
  }): `0x${string}` {
    return hashTypedData({
      domain: this.getDomain(args.chainId),
      primaryType: GPv2OrderHelper.TypedDataPrimaryType,
      types: GPv2OrderHelper.TypedDataTypes,
      message: args.order,
    });
  }

  /**
   * Returns the EIP-712 domain for the given chain
   *
   * @param chainId - chain ID to be used
   * @returns EIP-712 typed domain data
   *
   * Implementation taken from CoW SDL
   * @see https://github.com/cowprotocol/cow-sdk/blob/5aa61a03d2ed9921c5f95522866b2af0ceb1c24d/src/order-signing/orderSigningUtils.ts#L98
   */
  private getDomain(chainId: string): TypedDataDomain {
    return {
      name: GPv2OrderHelper.DomainName,
      version: GPv2OrderHelper.DomainVersion,
      chainId: Number(chainId),
      verifyingContract: GPv2OrderHelper.SettlementContractAddress,
    };
  }
}
