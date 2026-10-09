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
  type TransactionReceipt,
  toHex,
  zeroAddress,
} from 'viem';
import safeAbi from '@/abis/safe/v1.4.1/Safe.abi';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { getSafeTxHash } from '@/domain/common/utils/safe';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import type * as Tx from '@/modules/safenet/domain/entities/safenet-safe-transaction.entity';
import {
  SafenetPayerError,
  type SafenetPayerUnresolvedDetails,
  SafenetPayerUnresolvedError,
} from '@/modules/safenet/domain/errors/safenet-payer.error';
import {
  ISafenetPayer,
  type SafenetPayerResult,
} from '@/modules/safenet/domain/interfaces/safenet-payer.interface';
import * as Signer from '@/modules/safenet/domain/interfaces/safenet-payer-signer.interface';
import { safenetConsensusAbi } from '@/modules/safenet/domain/safenet-consensus.abi';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

const SAFENET_CHAIN_ID = '100';
const SUPPORTED_SAFE_VERSION = '1.4.1';
const PROPOSED_TOPIC =
  '0x47d867ce4d91d0487fa4d2ac80b13e7466ce53dd018a8eef564fc60c92b53d03';
const NEW_REQUEST_TOPIC =
  '0x8ec61272960f97d43d7f8f85ed630aa512818577f3d1e548e7627b06dbbbda86';
const EXECUTION_SUCCESS_TOPIC =
  '0x442e715f626346e8c54381002da614f62bee8d27386535b2521ec8540898556e';
const INCLUDED = 200;
const REJECTED = 400;
const REVERTED = 500;
// Operation CALL, then safeTxGas, baseGas, gasPrice, gasToken and refundReceiver all zero.
const NO_GAS = [0, 0n, 0n, 0n, zeroAddress, zeroAddress] as const;

type IncludedTask = SafenetPayerUnresolvedDetails & { transactionHash: Hex };

@Injectable()
export class SafenetPayer implements ISafenetPayer {
  private readonly consensusAddress: Address;
  private readonly oracleAddress: Address;
  private readonly payerSafeAddress: Address;
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private readonly nonceTtlSeconds: number;
  private versionVerified = false;
  private busy = false;

  constructor(
    @Inject(IConfigurationService) configuration: IConfigurationService,
    @Inject(IBlockchainApiManager)
    private readonly blockchain: IBlockchainApiManager,
    @Inject(CacheService) private readonly cache: ICacheService,
    @Inject(IRelayApi) private readonly relay: IRelayApi,
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

  /** Proposes a user transaction through the payer Safe and verifies its request receipt. */
  public async propose(
    transaction: Tx.SafenetSafeTransaction,
  ): Promise<SafenetPayerResult> {
    if (this.busy) throw new SafenetPayerError('Safenet payer is busy');
    this.busy = true;
    try {
      return await this.proposeSerialized(transaction);
    } finally {
      this.busy = false;
    }
  }

  private async proposeSerialized(transaction: Tx.SafenetSafeTransaction) {
    const client = await this.blockchain.getApi(SAFENET_CHAIN_ID);
    await this.assertSupportedVersion(client);
    const key = CacheRouter.getSafenetPayerNonceCacheKey({
      chainId: SAFENET_CHAIN_ID,
      safeAddress: this.payerSafeAddress,
    });
    const payerNonce = await this.nextNonce(client, key);
    const inner = encodeFunctionData({
      abi: safenetConsensusAbi,
      functionName: 'proposeTransaction',
      args: [this.oracleAddress, '0x', transaction],
    });
    const userSafeTxHash = await this.simulate(client, inner);
    const { payerSafeTxHash, data } = await this.signPayload(inner, payerNonce);
    const { taskId } = await this.relay.relay({
      chainId: SAFENET_CHAIN_ID,
      to: this.payerSafeAddress,
      data,
      safeTxHash: payerSafeTxHash,
    });
    const relayed = { taskId, payerNonce };
    const transactionHash = await this.poll(() => this.readTaskStatus(relayed));
    if (!transactionHash) {
      throw new SafenetPayerUnresolvedError(
        'Safenet payer relay timed out',
        relayed,
      );
    }
    const task = { ...relayed, transactionHash };
    const receipt = await this.readReceipt(client, task);
    const requestId = await this.verifyReceipt(receipt, task, {
      key,
      userSafeTxHash,
      payerSafeTxHash,
    });
    this.logging.info({
      chainId: SAFENET_CHAIN_ID,
      payerNonce: payerNonce.toString(),
      transactionHash,
      requestId,
    });
    return { userSafeTxHash, requestId, transactionHash, payerNonce };
  }

  private async assertSupportedVersion(client: PublicClient): Promise<void> {
    if (this.versionVerified) return;
    const version = await client.readContract({
      address: this.payerSafeAddress,
      abi: safeAbi,
      functionName: 'VERSION',
    });
    if (version !== SUPPORTED_SAFE_VERSION)
      throw new SafenetPayerError(`Unsupported payer Safe version ${version}`);
    this.versionVerified = true;
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
        owners: [this.signer.address],
        masterCopy: zeroAddress,
        fallbackHandler: zeroAddress,
        guard: zeroAddress,
        modules: null,
      },
      transaction: {
        to: this.consensusAddress,
        value: '0',
        data: inner,
        operation: 0,
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
      args: [this.consensusAddress, 0n, inner, ...NO_GAS, signature],
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

  /** Runs `read` until it returns a value, or `undefined` after `pollTimeoutMs`. */
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

  private async readTaskStatus(task: SafenetPayerUnresolvedDetails) {
    const ids = { chainId: SAFENET_CHAIN_ID, taskId: task.taskId };
    const result = await this.relay
      .getTaskStatus(ids)
      .catch((error: unknown) => {
        this.logging.warn({ ...ids, error: asError(error).name });
        return undefined;
      });
    if (!result) return undefined;
    this.logging.debug({ ...ids, status: result.status });
    if (result.status === REJECTED || result.status === REVERTED)
      throw new SafenetPayerError('Safenet payer relay failed');
    if (result.status !== INCLUDED) return undefined;
    const hash = HexSchema.safeParse(result.receipt?.transactionHash);
    if (!hash.success) {
      throw new SafenetPayerUnresolvedError(
        'Included relay has no receipt hash',
        task,
      );
    }
    return hash.data;
  }

  private async readReceipt(client: PublicClient, task: IncludedTask) {
    const { taskId, transactionHash } = task;
    const receipt = await this.poll(() =>
      client
        .getTransactionReceipt({ hash: transactionHash })
        .catch((error: unknown) => {
          const ids = { chainId: SAFENET_CHAIN_ID, taskId };
          this.logging.debug({ ...ids, error: asError(error).name });
          return undefined;
        }),
    );
    if (!receipt) {
      throw new SafenetPayerUnresolvedError(
        'Included payer receipt unavailable',
        task,
      );
    }
    return receipt;
  }

  private async verifyReceipt(
    receipt: TransactionReceipt,
    task: IncludedTask,
    hashes: { key: string; userSafeTxHash: Hex; payerSafeTxHash: Hex },
  ): Promise<Hex> {
    const unresolved = (message: string, options?: ErrorOptions) =>
      new SafenetPayerUnresolvedError(message, task, options);
    if (receipt.status !== 'success')
      throw new SafenetPayerError('Safenet payer receipt failed');
    const executed = this.findLog(receipt, this.payerSafeAddress, [
      EXECUTION_SUCCESS_TOPIC,
      hashes.payerSafeTxHash,
    ]);
    if (!executed) throw unresolved('Missing payer ExecutionSuccess');
    // ExecutionSuccess consumes the nonce even if the remaining checks fail.
    await this.cache
      .setCounter(
        hashes.key,
        Number(task.payerNonce + 1n),
        this.nonceTtlSeconds,
        0,
      )
      .catch((cause: unknown) => {
        throw unresolved('Safenet payer nonce counter write failed', { cause });
      });
    const proposed = this.findLog(receipt, this.consensusAddress, [
      PROPOSED_TOPIC,
      hashes.userSafeTxHash,
    ]);
    if (!proposed) throw unresolved('Missing Consensus TransactionProposed');
    const sponsor = toHex(BigInt(this.payerSafeAddress), { size: 32 });
    const request = this.findLog(receipt, this.oracleAddress, [
      NEW_REQUEST_TOPIC,
      null,
      sponsor,
    ]);
    const requestId = request?.topics[1];
    if (!requestId) throw unresolved('Missing payer Oracle NewRequest');
    return requestId;
  }

  /** Finds a log from `address` whose leading topics equal `topics` (`null` matches any). */
  private findLog(
    receipt: TransactionReceipt,
    address: Address,
    topics: Array<Hex | null>,
  ) {
    return receipt.logs.find(
      (log) =>
        isAddressEqual(log.address, address) &&
        topics.every((topic, i) => topic === null || log.topics[i] === topic),
    );
  }
}
