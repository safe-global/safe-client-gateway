// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { encodeFunctionData, type Hash, type Hex, isAddressEqual } from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { SignatureType } from '#/domain/common/entities/signature-type.entity';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import { getSafeSignature } from '#/domain/common/utils/client-signature';
import { getSafeTxHash } from '#/domain/common/utils/safe';
import { DataSourceError } from '#/domain/errors/data-source.error';
import { SafePolicyGuardAbi } from '#/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import { getSafePolicyGuardDeployments } from '#/modules/policies/domain/policy-deployments.constants';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';

enum ErrorMessage {
  NotQueued = 'The Safe transaction is not queued for this Safe',
  HashMismatch = 'Invalid safeTxHash',
  NotRequestConfiguration = 'The Safe transaction does not request the configuration root',
  NotSafeGuard = "The Safe transaction does not target the Safe's policy guard",
  InvalidSignature = 'Invalid signature',
  EthSignDisabled = 'eth_sign is disabled',
}

/**
 * Proves a policy configuration request is backed by an owner: a queued Safe
 * transaction calling `requestConfiguration(root)` on the Safe's policy guard,
 * signed by a current owner of the Safe.
 */
@Injectable()
export class PolicyConfigurationRequestVerifier {
  private readonly isEthSignEnabled: boolean;

  public constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.isEthSignEnabled =
      this.configurationService.getOrThrow('features.ethSign');
  }

  /** @throws {HttpExceptionNoLog} 422 when any check fails */
  public async verify(args: {
    safe: SafeRef;
    root: Hex;
    safeTxHash: Hash;
    signature: Hex;
  }): Promise<void> {
    const [safe, transaction] = await Promise.all([
      this.safeRepository.getSafe(args.safe),
      this.getQueuedTransaction(args),
    ]);

    this.assertQueued({ safe, transaction });
    this.assertSafeTxHash({ chainId: args.safe.chainId, safe, transaction });
    this.assertRequestsRoot({
      chainId: args.safe.chainId,
      safe,
      root: args.root,
      transaction,
    });
    this.assertSignedByOwner({
      safe,
      transaction,
      signature: args.signature,
    });
  }

  private async getQueuedTransaction(args: {
    safe: SafeRef;
    safeTxHash: Hash;
  }): Promise<MultisigTransaction> {
    try {
      return await this.safeRepository.getMultiSigTransaction({
        chainId: args.safe.chainId,
        safeTransactionHash: args.safeTxHash,
      });
    } catch (error) {
      if (
        error instanceof DataSourceError &&
        error.code === HttpStatus.NOT_FOUND
      ) {
        throw this.reject(ErrorMessage.NotQueued);
      }
      throw error;
    }
  }

  /** The Transaction Service serves any Safe's transaction by hash. */
  private assertQueued(args: {
    safe: Safe;
    transaction: MultisigTransaction;
  }): void {
    if (
      !isAddressEqual(args.transaction.safe, args.safe.address) ||
      args.transaction.isExecuted ||
      args.transaction.nonce < args.safe.nonce
    ) {
      throw this.reject(ErrorMessage.NotQueued);
    }
  }

  /** Recomputed rather than trusting the hash the Transaction Service keys it by. */
  private assertSafeTxHash(args: {
    chainId: string;
    safe: Safe;
    transaction: MultisigTransaction;
  }): void {
    let safeTxHash: Hash;
    try {
      safeTxHash = getSafeTxHash(args);
    } catch {
      throw this.reject(ErrorMessage.HashMismatch);
    }
    if (safeTxHash !== args.transaction.safeTxHash) {
      throw this.reject(ErrorMessage.HashMismatch);
    }
  }

  private assertRequestsRoot(args: {
    chainId: string;
    safe: Safe;
    root: Hex;
    transaction: MultisigTransaction;
  }): void {
    const expected = encodeFunctionData({
      abi: SafePolicyGuardAbi,
      functionName: 'requestConfiguration',
      args: [args.root],
    });
    const { data, operation, to } = args.transaction;
    if (
      operation !== Operation.CALL ||
      !data ||
      data.toLowerCase() !== expected.toLowerCase()
    ) {
      throw this.reject(ErrorMessage.NotRequestConfiguration);
    }

    const isKnownGuard = getSafePolicyGuardDeployments(args.chainId).some(
      (guard) => isAddressEqual(guard, to),
    );
    const isEnabledGuard = [args.safe.guard, args.safe.moduleGuard].some(
      (guard) => guard && isAddressEqual(guard, to),
    );
    if (!(isKnownGuard && isEnabledGuard)) {
      throw this.reject(ErrorMessage.NotSafeGuard);
    }
  }

  /**
   * An EOA or eth_sign signature is recovered here. A contract signature or
   * approved hash cannot be checked off-chain, so it must already be a
   * confirmation the Transaction Service validated.
   */
  private assertSignedByOwner(args: {
    safe: Safe;
    transaction: MultisigTransaction;
    signature: Hex;
  }): void {
    const signature = getSafeSignature({
      signature: args.signature,
      hash: args.transaction.safeTxHash,
      code: HttpStatus.UNPROCESSABLE_ENTITY,
    });

    if (
      signature.signatureType === SignatureType.EthSign &&
      !this.isEthSignEnabled
    ) {
      throw this.reject(ErrorMessage.EthSignDisabled);
    }

    const isOwner = args.safe.owners.some((owner) =>
      isAddressEqual(owner, signature.owner),
    );
    const isRecovered =
      signature.signatureType === SignatureType.Eoa ||
      signature.signatureType === SignatureType.EthSign;
    const isConfirmed = !!args.transaction.confirmations?.some(
      (confirmation) =>
        isAddressEqual(confirmation.owner, signature.owner) &&
        confirmation.signature?.toLowerCase() === args.signature.toLowerCase(),
    );
    if (!(isOwner && (isRecovered || isConfirmed))) {
      throw this.reject(ErrorMessage.InvalidSignature);
    }
  }

  private reject(message: ErrorMessage): HttpExceptionNoLog {
    return new HttpExceptionNoLog(message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
