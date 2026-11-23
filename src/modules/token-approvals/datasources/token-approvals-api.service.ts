// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type Address, encodeEventTopics, erc20Abi, toHex } from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { CacheRouter } from '#/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '#/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import { IBlockchainApiManager } from '#/domain/interfaces/blockchain-api.manager.interface';
import type { AllowanceRead } from '#/modules/token-approvals/domain/entities/allowance-read.entity';
import type { ApprovalLog } from '#/modules/token-approvals/domain/entities/approval-log.entity';
import type { TokenSpender } from '#/modules/token-approvals/domain/entities/token-approval.entity';
import type { TokenApprovalsScanState } from '#/modules/token-approvals/domain/entities/token-approvals-scan-state.entity';
import {
  MULTICALL_BATCH_SIZE_BYTES,
  MULTICALL3_ADDRESS,
} from '#/modules/token-approvals/domain/token-approvals.constants';
import { type Raw, rawify } from '#/validation/entities/raw.entity';

/**
 * Reads the approvals of a Safe from the chain, and keeps how far the scan of
 * its `Approval` logs got.
 */
@Injectable()
export class TokenApprovalsApi {
  private readonly scanExpirationTimeSeconds: number;

  constructor(
    @Inject(IBlockchainApiManager)
    private readonly blockchainApiManager: IBlockchainApiManager,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.scanExpirationTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.tokenApprovals',
      );
  }

  /** The latest block, read past the RPC cache so it is current. */
  async getHeadBlockNumber(chainId: string): Promise<Raw<bigint>> {
    const client = await this.blockchainApiManager.getUncachedApi({ chainId });
    try {
      return rawify(await client.getBlockNumber());
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  /**
   * The `Approval` logs of any contract with {@link args.owner} as the owner,
   * from {@link args.fromBlock} to {@link args.toBlock}, both included.
   */
  async getApprovalLogs(args: {
    chainId: string;
    owner: Address;
    fromBlock: number;
    toBlock: number;
  }): Promise<Raw<Array<ApprovalLog>>> {
    const client = await this.blockchainApiManager.getApi(args.chainId);
    const topics = encodeEventTopics({
      abi: erc20Abi,
      eventName: 'Approval',
      args: { owner: args.owner },
    });
    try {
      return rawify(
        await client.request({
          method: 'eth_getLogs',
          params: [
            {
              fromBlock: toHex(args.fromBlock),
              toBlock: toHex(args.toBlock),
              topics,
            },
          ],
        }),
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  /**
   * The allowance {@link args.owner} gives each spender at
   * {@link args.blockNumber}, read past the RPC cache. A call that fails is
   * reported as a failure, in the same position.
   */
  async getAllowances(args: {
    chainId: string;
    owner: Address;
    pairs: Array<TokenSpender>;
    blockNumber: number;
  }): Promise<Raw<Array<AllowanceRead>>> {
    const client = await this.blockchainApiManager.getUncachedApi({
      chainId: args.chainId,
    });
    const contracts = args.pairs.map(
      ({ tokenAddress, spender }) =>
        ({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [args.owner, spender],
        }) as const,
    );
    try {
      return rawify(
        await client.multicall({
          allowFailure: true,
          multicallAddress: MULTICALL3_ADDRESS,
          batchSize: MULTICALL_BATCH_SIZE_BYTES,
          blockNumber: BigInt(args.blockNumber),
          contracts,
        }),
      );
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getScanState(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Raw<TokenApprovalsScanState> | null> {
    const value = await this.cacheService.hGet(
      CacheRouter.getTokenApprovalsScanCacheDir(args),
    );
    return value === null ? null : rawify(JSON.parse(value));
  }

  /** Stores the scan state and starts its expiry again. */
  async setScanState(args: {
    chainId: string;
    safeAddress: Address;
    state: TokenApprovalsScanState;
  }): Promise<void> {
    const cacheDir = CacheRouter.getTokenApprovalsScanCacheDir(args);
    // hSet keeps the expiry a key already has, so the old entry goes first.
    await this.cacheService.deleteByKey(cacheDir.key);
    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(args.state),
      this.scanExpirationTimeSeconds,
    );
  }
}
