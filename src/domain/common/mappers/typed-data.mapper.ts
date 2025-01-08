import { Inject, Injectable } from '@nestjs/common';
import semverSatisfies from 'semver/functions/satisfies';
import {
  getTypesForEIP712Domain,
  hashDomain,
  hashMessage,
  hashStruct,
  hashTypedData,
} from 'viem';
import type { TypedDataDefinition } from 'viem';

import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { TypedData } from '@/routes/transactions/entities/typed-data/typed-data.entity';
import type { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import type { Safe } from '@/domain/safe/entities/safe.entity';

@Injectable()
export class TypedDataMapper {
  // Domain
  private static readonly CHAIN_ID_DOMAIN_HASH_VERSION = '>=1.3.0';

  // Message
  private static readonly TRANSACTION_PRIMARY_TYPE = 'SafeTx';
  private static readonly MESSAGE_PRIMARY_TYPE = 'SafeMessage';
  private static readonly BASE_GAS_SAFETX_HASH_VERSION = '>=1.0.0';

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Calculates and maps hashes of domain and `SafeTx` for Safe transaction
   * @param args.chainId - Chain ID
   * @param args.safe - {@link Safe} entity
   * @param args.transaction - {@link MultisigTransaction} entity
   * @returns - {@link TypedData} containing hashes of domain/message
   */
  public mapSafeTxTypedData(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
  }): TypedData {
    return new TypedData({
      domainHash: this.getDomainHash(args),
      messageHash: this.getSafeTxMessageHash(args),
    });
  }

  /**
   * Calculates and maps hashes of domain and `SafeMessage` of Safe message
   * @param args.chainId - Chain ID
   * @param args.safe - {@link Safe} entity
   * @param args.message - Message string or {@link TypedDataDefinition} entity
   * @returns - {@link TypedData} containing hashes of domain/message
   */
  public mapSafeMessageTypedData(args: {
    chainId: string;
    safe: Safe;
    message: string | TypedDataDefinition;
  }): TypedData {
    return new TypedData({
      domainHash: this.getDomainHash(args),
      messageHash: this.getSafeMessageMessageHash(args),
    });
  }

  /**
   * Calculates domain hash for Safe:
   *
   * Note: if Safe version is available:
   * - If Safe version <1.3.0, domain separator contains no `chainId`
   *   @see https://github.com/safe-global/safe-smart-account/blob/v1.2.0/contracts/GnosisSafe.sol#L23-L26
   * - If Safe version >=1.3.0, domain separator contains `chainId`
   *   @see https://github.com/safe-global/safe-smart-account/blob/v1.3.0/contracts/GnosisSafe.sol#L35-L38
   *
   * @param args.chainId - Chain ID
   * @param args.safe - {@link Safe} entity
   * @returns - Domain hash or `null` if no version or hashing failed
   */
  private getDomainHash(args: {
    chainId: string;
    safe: Safe;
  }): `0x${string}` | null {
    if (!args.safe.version) {
      return null;
    }

    // >=1.3.0 Safe contracts include the `chainId` in domain separator
    const includesChainId = semverSatisfies(
      args.safe.version,
      TypedDataMapper.CHAIN_ID_DOMAIN_HASH_VERSION,
    );
    const domain = {
      ...(includesChainId && { chainId: Number(args.chainId) }),
      verifyingContract: args.safe.address,
    };

    try {
      return hashDomain({
        domain: {
          chainId: Number(args.chainId),
          verifyingContract: args.safe.address,
        },
        types: {
          EIP712Domain: getTypesForEIP712Domain({ domain }),
        },
      });
    } catch {
      this.loggingService.error(
        `Failed to hash domain for ${args.safe.address}`,
      );
      return null;
    }
  }

  /**
   * Calculates and maps hash of `SafeTx` for Safe transaction
   *
   * Note: if Safe version is available:
   * - If Safe version <1.0.0, `dataGas` is used in `SafeTx` hash
   *   @see https://github.com/safe-global/safe-smart-account/blob/v0.1.0/contracts/GnosisSafe.sol#L25-L28
   * - If Safe version >=1.0.0, `baseGas` is used in `SafeTx` hash
   *   @see https://github.com/safe-global/safe-smart-account/blob/v1.0.0/contracts/GnosisSafe.sol#L25-L28
   *
   * @param args.chainId - Chain ID
   * @param args.safe - {@link Safe} entity
   * @param args.transaction - {@link MultisigTransaction} entity
   * @returns - Hash of `SafeTx` or `null` if no version, missing transaction data or hashing failed
   */
  private getSafeTxMessageHash(args: {
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
      TypedDataMapper.BASE_GAS_SAFETX_HASH_VERSION,
    );
    const dataGasOrBaseGas = usesBaseGas ? 'baseGas' : 'dataGas';

    try {
      return hashStruct({
        primaryType: TypedDataMapper.TRANSACTION_PRIMARY_TYPE,
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
    } catch {
      this.loggingService.error(
        `Failed to hash SafeTx for ${args.safe.address}`,
      );
      return null;
    }
  }

  /**
   * Calculates and maps hash of `SafeMessage` for Safe message
   * @param args.safe - {@link Safe} entity
   * @param args.message - Message string or {@link TypedDataDefinition} entity
   * @returns - Hash of `SafeMessage` or `null` if hashing failed
   */
  private getSafeMessageMessageHash(args: {
    safe: Safe;
    message: string | TypedDataDefinition;
  }): `0x${string}` | null {
    try {
      return hashStruct({
        primaryType: TypedDataMapper.MESSAGE_PRIMARY_TYPE,
        data: {
          message:
            typeof args.message === 'string'
              ? hashMessage(args.message)
              : hashTypedData(args.message),
        },
        types: {
          SafeMessage: [{ name: 'message', type: 'bytes' }],
        },
      });
    } catch {
      this.loggingService.error(
        `Failed to hash SafeMessage for ${args.safe.address}`,
      );
      return null;
    }
  }
}
