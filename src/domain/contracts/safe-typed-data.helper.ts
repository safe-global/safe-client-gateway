import { Injectable } from '@nestjs/common';
import semverSatisfies from 'semver/functions/satisfies';
import { getTypesForEIP712Domain, hashDomain, hashStruct } from 'viem';
import type { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import type { Safe } from '@/domain/safe/entities/safe.entity';

@Injectable()
export class SafeTypedDataHelper {
  private static readonly CHAIN_ID_DOMAIN_HASH_VERSION = '>=1.3.0';
  private static readonly BASE_GAS_SAFETX_HASH_VERSION = '>=1.0.0';

  public getDomainHash(args: {
    chainId: string;
    safe: Safe;
  }): `0x${string}` | null {
    if (!args.safe.version) {
      return null;
    }

    // >=1.3.0 Safe contracts include the `chainId` in domain separator
    const includesChainId = semverSatisfies(
      args.safe.version,
      SafeTypedDataHelper.CHAIN_ID_DOMAIN_HASH_VERSION,
    );
    const domain = {
      ...(includesChainId && { chainId: Number(args.chainId) }),
      verifyingContract: args.safe.address,
    };

    return hashDomain({
      domain: {
        chainId: Number(args.chainId),
        verifyingContract: args.safe.address,
      },
      types: {
        EIP712Domain: getTypesForEIP712Domain({ domain }),
      },
    });
  }

  public getSafeTxMessageHash(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
  }): `0x${string}` | null {
    if (!args.safe.version) {
      return null;
    }

    const {
      to,
      value,
      data,
      operation,
      safeTxGas,
      baseGas,
      gasPrice,
      gasToken,
      refundReceiver,
      nonce,
    } = args.transaction;

    if (
      data === null ||
      safeTxGas === null ||
      baseGas === null ||
      gasPrice === null ||
      gasToken === null ||
      refundReceiver === null
    ) {
      return null;
    }

    // >=1.0.0 Safe contracts use `baseGas` instead of `dataGas`
    const usesBaseGas = semverSatisfies(
      args.safe.version,
      SafeTypedDataHelper.BASE_GAS_SAFETX_HASH_VERSION,
    );
    const dataGasOrBaseGas = usesBaseGas ? 'baseGas' : 'dataGas';

    return hashStruct({
      primaryType: 'SafeTx',
      data: {
        to,
        value,
        data,
        operation,
        safeTxGas,
        [dataGasOrBaseGas]: baseGas,
        gasPrice,
        gasToken,
        refundReceiver,
        nonce,
      },
      types: {
        SafeTx: [
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
      },
    });
  }
}
