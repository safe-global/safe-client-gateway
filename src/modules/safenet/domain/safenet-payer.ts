// SPDX-License-Identifier: FSL-1.1-MIT
import { setTimeout as sleep } from 'node:timers/promises';
import { Inject, Injectable } from '@nestjs/common';
import {
  type Address,
  BaseError,
  decodeFunctionResult,
  encodeFunctionData,
  type Hex,
  isAddressEqual,
  type PublicClient,
  TransactionReceiptNotFoundError,
  zeroAddress,
} from 'viem';
import safeAbi from '#/abis/safe/v1.4.1/Safe.abi';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { CacheRouter } from '#/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '#/datasources/cache/cache.service.interface';
import { getSafeTxHash } from '#/domain/common/utils/safe';
import { IBlockchainApiManager } from '#/domain/interfaces/blockchain-api.manager.interface';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import { RelayRepository } from '#/modules/relay/domain/relay.repository';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';
import type {
  SafenetPayerResult,
  SafenetProposal,
  SafenetRelayedTask,
} from '#/modules/safenet/domain/entities/safenet-payer.entity';
import { SafenetPayerError } from '#/modules/safenet/domain/errors/safenet-payer.error';
import { SafenetPayerMaybePaidError } from '#/modules/safenet/domain/errors/safenet-payer-maybe-paid.error';
import * as Signer from '#/modules/safenet/domain/interfaces/safenet-payer-signer.interface';
import {
  EXECUTION_SUCCESS_TOPIC,
  NO_EXTRA_DATA,
  NO_REFUND_EXEC_ARGS,
  RELAY_STATUS_INCLUDED,
  RELAY_STATUS_REJECTED,
  RELAY_STATUS_REVERTED,
  SAFENET_CHAIN_ID,
  SUPPORTED_SAFE_VERSION,
} from '#/modules/safenet/domain/safenet.constants';
import { safenetConsensusAbi } from '#/modules/safenet/domain/safenet-consensus.abi';
import { toSafenetConsensusTransaction } from '#/modules/safenet/domain/safenet-consensus-transaction.mapper';
import { HexSchema } from '#/validation/entities/schemas/hex.schema';

@Injectable()
export class SafenetPayer {
  private readonly consensusAddress: Address;
  private readonly oracleAddress: Address;
  private readonly payerSafeAddress: Address;
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private readonly nonceTtlSeconds: number;
  private ownerVerified = false;

  constructor(
    @Inject(IConfigurationService) configuration: IConfigurationService,
    @Inject(IBlockchainApiManager)
    private readonly blockchain: IBlockchainApiManager,
    @Inject(CacheService) private readonly cache: ICacheService,
    @Inject(RelayRepository) private readonly relay: RelayRepository,
    @Inject(Signer.ISafenetPayerSigner)
    private readonly signer: Signer.ISafenetPayerSigner,
    @Inject(LoggingService) private readonly logging: ILoggingService,
  ) {
    this.consensusAddress = configuration.getOrThrow(
      'safenet.consensusAddress',
    );
    this.oracleAddress = configuration.getOrThrow('safenet.oracleAddress');
    this.payerSafeAddress = configuration.getOrThrow(
      'safenet.payer.safeAddress',
    );
    this.pollIntervalMs = configuration.getOrThrow('safenet.pollIntervalMs');
    this.pollTimeoutMs = configuration.getOrThrow('safenet.pollTimeoutMs');
    this.nonceTtlSeconds = configuration.getOrThrow(
      'expirationTimeInSeconds.safenetNonce',
    );
  }

  /** Proposes a user transaction through the payer Safe once the payer Safe has executed it. */
  public async propose(proposal: SafenetProposal): Promise<SafenetPayerResult> {
    const { client, key, payerNonce, userSafeTxHash, payerSafeTxHash, data } =
      await this.prepare(proposal);
    const task = await this.relayPayload(data, payerSafeTxHash, payerNonce);
    const transactionHash = await this.waitForInclusion(task);
    await this.confirmExecution(client, task, {
      transactionHash,
      payerSafeTxHash,
    });
    await this.recordNonce(key, payerNonce);
    this.logging.info({
      chainId: SAFENET_CHAIN_ID,
      payerNonce: payerNonce.toString(),
      transactionHash,
    });
    return { userSafeTxHash, transactionHash, payerNonce };
  }

  private async prepare(proposal: SafenetProposal) {
    const client = await this.blockchain.getUncachedApi(SAFENET_CHAIN_ID);
    await this.assertSignerIsOwner(client);
    const key = CacheRouter.getSafenetPayerNonceCacheKey({
      chainId: SAFENET_CHAIN_ID,
      safeAddress: this.payerSafeAddress,
    });
    const payerNonce = await this.nextNonce(client, key);
    const inner = encodeFunctionData({
      abi: safenetConsensusAbi,
      functionName: 'proposeTransaction',
      args: [
        this.oracleAddress,
        NO_EXTRA_DATA,
        toSafenetConsensusTransaction(proposal),
      ],
    });
    const userSafeTxHash = await this.simulate(client, inner);
    const { payerSafeTxHash, data } = await this.signPayload(inner, payerNonce);
    return { client, key, payerNonce, userSafeTxHash, payerSafeTxHash, data };
  }

  private async relayPayload(
    data: Hex,
    payerSafeTxHash: Hex,
    payerNonce: bigint,
  ): Promise<SafenetRelayedTask> {
    const { taskId } = await this.relay.relayWithoutLimits({
      chainId: SAFENET_CHAIN_ID,
      to: this.payerSafeAddress,
      data,
      safeTxHash: payerSafeTxHash,
    });
    return { taskId, payerNonce };
  }

  private async waitForInclusion(task: SafenetRelayedTask): Promise<Hex> {
    const transactionHash = await this.poll(() => this.readTaskStatus(task));
    if (!transactionHash) {
      throw new SafenetPayerMaybePaidError(
        'Safenet payer relay timed out',
        task,
      );
    }
    return transactionHash;
  }

  private async recordNonce(key: string, payerNonce: bigint): Promise<void> {
    await this.cache
      .setCounter(key, Number(payerNonce + 1n), this.nonceTtlSeconds, 0)
      .catch((error: unknown) => {
        // The proposal is paid and confirmed, and the next job reads the on-chain nonce.
        this.logging.warn({
          chainId: SAFENET_CHAIN_ID,
          payerNonce: payerNonce.toString(),
          error: asError(error).name,
        });
      });
  }

  /** The signer must own the payer Safe, or `execTransaction` rejects its signature. */
  private async assertSignerIsOwner(client: PublicClient): Promise<void> {
    if (this.ownerVerified) {
      return;
    }
    const signer = await this.signer.getAddress();
    const isOwner = await client.readContract({
      address: this.payerSafeAddress,
      abi: safeAbi,
      functionName: 'isOwner',
      args: [signer],
    });
    if (!isOwner) {
      throw new SafenetPayerError(`Signer ${signer} is not a payer Safe owner`);
    }
    this.ownerVerified = true;
  }

  private async nextNonce(client: PublicClient, key: string): Promise<bigint> {
    const [onchainNonce, counter] = await Promise.all([
      client.readContract({
        address: this.payerSafeAddress,
        abi: safeAbi,
        functionName: 'nonce',
      }),
      this.cache.getCounter(key),
    ]);
    const cachedNonce = BigInt(counter ?? 0);
    return onchainNonce > cachedNonce ? onchainNonce : cachedNonce;
  }

  private async signPayload(inner: Hex, payerNonce: bigint) {
    const payerSafeTxHash = getSafeTxHash({
      chainId: SAFENET_CHAIN_ID,
      safe: {
        address: this.payerSafeAddress,
        version: SUPPORTED_SAFE_VERSION,
        nonce: Number(payerNonce),
        threshold: 1,
        owners: [await this.signer.getAddress()],
        masterCopy: zeroAddress,
        fallbackHandler: zeroAddress,
        guard: zeroAddress,
        modules: null,
        moduleGuard: null,
      },
      transaction: {
        to: this.consensusAddress,
        value: '0',
        data: inner,
        operation: Operation.CALL,
        nonce: Number(payerNonce),
        safeTxGas: 0,
        baseGas: 0,
        gasPrice: '0',
        gasToken: zeroAddress,
        refundReceiver: zeroAddress,
      },
    });
    const signature = await this.signer.signHash(payerSafeTxHash);
    const data = encodeFunctionData({
      abi: safeAbi,
      functionName: 'execTransaction',
      args: [
        this.consensusAddress,
        0n,
        inner,
        ...NO_REFUND_EXEC_ARGS,
        signature,
      ],
    });
    return { payerSafeTxHash, data };
  }

  private async simulate(client: PublicClient, data: Hex): Promise<Hex> {
    try {
      const result = await client.call({
        account: this.payerSafeAddress,
        to: this.consensusAddress,
        data,
      });
      return decodeFunctionResult({
        abi: safenetConsensusAbi,
        functionName: 'proposeTransaction',
        data: result.data ?? '0x',
      });
    } catch (error) {
      // viem errors embed the call arguments, so only the short message is kept.
      const reason =
        error instanceof BaseError ? error.shortMessage : 'unexpected error';
      throw new SafenetPayerError(
        `Safenet proposal simulation failed: ${reason}`,
      );
    }
  }

  private async poll<T>(read: () => Promise<T | undefined>) {
    const deadline = Date.now() + this.pollTimeoutMs;
    let value = await read();
    while (value === undefined && Date.now() < deadline) {
      await sleep(
        Math.max(0, Math.min(this.pollIntervalMs, deadline - Date.now())),
      );
      value = await read();
    }
    return value;
  }

  /** Resolves to the transaction hash once the relay reports the task as included. */
  private async readTaskStatus(task: SafenetRelayedTask) {
    const ids = { chainId: SAFENET_CHAIN_ID, taskId: task.taskId };
    const result = await this.relay
      .getTaskStatus(ids)
      .catch((error: unknown) => {
        this.logging.warn({ ...ids, error: asError(error).name });
        return undefined;
      });
    if (!result) {
      return undefined;
    }
    if (result.status === RELAY_STATUS_REJECTED) {
      throw new SafenetPayerError('Safenet payer relay rejected');
    }
    // A copy of the signed payload may have landed first and paid, so a revert proves nothing.
    if (result.status === RELAY_STATUS_REVERTED) {
      throw new SafenetPayerMaybePaidError(
        'Safenet payer relay reverted',
        task,
      );
    }
    // Pending, submitted and unknown statuses keep polling.
    if (result.status !== RELAY_STATUS_INCLUDED) {
      return undefined;
    }
    const hash = HexSchema.safeParse(result.receipt?.transactionHash);
    return hash.success ? hash.data : undefined;
  }

  /** A mined `execTransaction` can still revert, so the receipt must show `ExecutionSuccess`. */
  private async confirmExecution(
    client: PublicClient,
    task: SafenetRelayedTask,
    included: { transactionHash: Hex; payerSafeTxHash: Hex },
  ): Promise<void> {
    // A receipt that is not found yet counts as pending; so does an RPC error, but it is logged.
    const receipt = await this.poll(() =>
      client
        .getTransactionReceipt({ hash: included.transactionHash })
        .catch((error: unknown) => {
          if (!(error instanceof TransactionReceiptNotFoundError)) {
            this.logging.warn({
              chainId: SAFENET_CHAIN_ID,
              transactionHash: included.transactionHash,
              error: asError(error).name,
            });
          }
          return undefined;
        }),
    );
    if (!receipt) {
      throw new SafenetPayerMaybePaidError(
        'Safenet payer receipt unavailable',
        task,
      );
    }
    if (receipt.status !== 'success') {
      throw new SafenetPayerMaybePaidError(
        'Safenet payer receipt failed',
        task,
      );
    }
    const executed = receipt.logs.some(
      (log) =>
        isAddressEqual(log.address, this.payerSafeAddress) &&
        log.topics[0] === EXECUTION_SUCCESS_TOPIC &&
        log.topics[1] === included.payerSafeTxHash,
    );
    if (!executed) {
      throw new SafenetPayerMaybePaidError(
        'Missing payer ExecutionSuccess',
        task,
      );
    }
  }
}
