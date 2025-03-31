import { Injectable } from '@nestjs/common';
import semverSatisfies from 'semver/functions/satisfies';
import { hashMessage, hashTypedData, zeroAddress } from 'viem';
import { MessageSchema } from '@/domain/messages/entities/message.entity';
import { TypedData } from '@/domain/messages/entities/typed-data.entity';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { Safe } from '@/domain/safe/entities/safe.entity';

// TODO: Delete safe.ts
@Injectable()
export class SafeHashHelper {
  // Domain
  private static readonly CHAIN_ID_DOMAIN_HASH_VERSION = '>=1.3.0';
  // SafeTx
  private static readonly TRANSACTION_PRIMARY_TYPE = 'SafeTx';
  private static readonly BASE_GAS_SAFETX_HASH_VERSION = '>=1.0.0';
  // SafeMessage
  private static readonly MESSAGE_PRIMARY_TYPE = 'SafeMessage';

  public generateSafeTxHash(args: {
    chainId: string;
    safe: Safe;
    transaction: {
      to: `0x${string}`;
      value: string;
      data: `0x${string}` | null;
      operation: Operation;
      nonce: number;
      safeTxGas: number | null;
      baseGas: number | null;
      gasPrice: string | null;
      gasToken: `0x${string}` | null;
      refundReceiver: `0x${string}` | null;
      safeTxHash: `0x${string}`;
    };
  }): `0x${string}` {
    const domain = this.generateDomainSeparator(args);

    const usesBaseGas = args.safe.version
      ? semverSatisfies(
          args.safe.version,
          SafeHashHelper.BASE_GAS_SAFETX_HASH_VERSION,
        )
      : true;
    const dataGasOrBaseGas = (usesBaseGas ? 'baseGas' : 'dataGas') as 'baseGas';

    const types = {
      [SafeHashHelper.TRANSACTION_PRIMARY_TYPE]: [
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        { name: 'operation', type: 'uint8' },
        { name: 'safeTxGas', type: 'uint256' },
        { name: dataGasOrBaseGas, type: 'uint256' },
        { name: 'gasPrice', type: 'uint256' },
        { name: 'gasToken', type: 'address' },
        { name: 'refundReceiver', type: 'address' },
        { name: 'nonce', type: 'uint256' },
      ],
    };

    // TODO: Explain choice behind defaults
    const data = args.transaction.data ?? '0x';
    const gasToken = args.transaction.gasToken ?? zeroAddress;
    const refundReceiver = args.transaction.refundReceiver ?? zeroAddress;
    const safeTxGas = args.transaction.safeTxGas ?? 0;
    const baseGas = args.transaction.baseGas ?? 0;
    const gasPrice = args.transaction.gasPrice ?? 0;

    try {
      const message = {
        to: args.transaction.to,
        value: BigInt(args.transaction.value),
        data,
        operation: args.transaction.operation,
        safeTxGas: BigInt(safeTxGas),
        [dataGasOrBaseGas]: BigInt(baseGas),
        gasPrice: BigInt(gasPrice),
        gasToken,
        refundReceiver,
        nonce: BigInt(args.transaction.nonce),
      };

      return hashTypedData({
        domain,
        primaryType: SafeHashHelper.TRANSACTION_PRIMARY_TYPE,
        types,
        message,
      });
    } catch {
      throw new Error('Failed to hash SafeTx');
    }
  }

  public generateSafeMessageHash(args: {
    chainId: string;
    safe: Safe;
    message: string | TypedData;
  }): `0x${string}` {
    const domain = this.generateDomainSeparator(args);

    const types = {
      [SafeHashHelper.MESSAGE_PRIMARY_TYPE]: [
        {
          name: 'message',
          type: 'bytes',
        },
      ],
    };

    try {
      const message = MessageSchema.shape.message.parse(args.message);

      return hashTypedData({
        domain,
        primaryType: SafeHashHelper.MESSAGE_PRIMARY_TYPE,
        types,
        message: {
          message:
            typeof message === 'string'
              ? hashMessage(message)
              : hashTypedData(message),
        },
      });
    } catch {
      throw new Error('Failed to hash SafeMessage');
    }
  }

  private generateDomainSeparator(args: { chainId: string; safe: Safe }):
    | {
        verifyingContract: `0x${string}`;
        chainId?: never;
      }
    | {
        verifyingContract: `0x${string}`;
        chainId: number;
      } {
    // TODO: Explain choice behind default
    const includesChainId = args.safe.version
      ? semverSatisfies(
          args.safe.version,
          SafeHashHelper.CHAIN_ID_DOMAIN_HASH_VERSION,
        )
      : true;

    return {
      ...(includesChainId && { chainId: Number(args.chainId) }),
      verifyingContract: args.safe.address,
    };
  }
}
