// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import uniqBy from 'lodash/uniqBy';
import {
  type Address,
  erc20Abi,
  getAddress,
  type Hex,
  type PublicClient,
  parseEventLogs,
} from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { batched } from '#/domain/common/utils/batch';
import type { Page } from '#/domain/entities/page.entity';
import { IBlockchainApiManager } from '#/domain/interfaces/blockchain-api.manager.interface';
import { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';
import type {
  TokenApproval,
  TokenApprovals,
  TokenSpender,
} from '#/modules/token-approvals/domain/entities/token-approval.entity';
import type {
  ExecutedSafeCall,
  SafeCallHistory,
} from '#/modules/token-approvals/domain/entities/token-approval-call.entity';
import { TokenApprovalCallsHelper } from '#/modules/token-approvals/domain/helpers/token-approval-calls.helper';
import {
  HISTORY_PAGE_SIZE,
  MULTICALL_BATCH_SIZE_BYTES,
  MULTICALL3_ADDRESS,
} from '#/modules/token-approvals/domain/token-approvals.constants';
import type { ITokenApprovalsRepository } from '#/modules/token-approvals/domain/token-approvals.repository.interface';

@Injectable()
export class TokenApprovalsRepository implements ITokenApprovalsRepository {
  private readonly maxHistoryPages: number;
  private readonly historyConcurrency: number;
  private readonly receiptsConcurrency: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IBlockchainApiManager)
    private readonly blockchainApiManager: IBlockchainApiManager,
    private readonly tokenApprovalCallsHelper: TokenApprovalCallsHelper,
  ) {
    this.maxHistoryPages = this.configurationService.getOrThrow<number>(
      'tokenApprovals.history.maxPages',
    );
    this.historyConcurrency = this.configurationService.getOrThrow<number>(
      'tokenApprovals.history.concurrency',
    );
    this.receiptsConcurrency = this.configurationService.getOrThrow<number>(
      'tokenApprovals.receipts.concurrency',
    );
  }

  async getTokenApprovals(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<TokenApprovals> {
    const [multisigHistory, moduleHistory, client] = await Promise.all([
      this.getHistory((page) =>
        this.safeRepository.getMultisigTransactions({
          ...args,
          executed: true,
          ...page,
        }),
      ),
      this.getHistory((page) =>
        this.safeRepository.getModuleTransactions({ ...args, ...page }),
      ),
      this.blockchainApiManager.getApi(args.chainId),
    ]);

    const { tokenSpenders, transactionHashes } = this.findCalldataApprovals([
      ...multisigHistory.calls,
      ...moduleHistory.calls,
    ]);
    const eventTokenSpenders = await this.getEventTokenSpenders({
      client,
      safeAddress: args.safeAddress,
      transactionHashes,
    });
    const approvals = await this.getLiveApprovals({
      client,
      safeAddress: args.safeAddress,
      tokenSpenders: [...tokenSpenders, ...eventTokenSpenders],
    });

    return {
      approvals,
      isHistoryComplete: multisigHistory.isComplete && moduleHistory.isComplete,
    };
  }

  /**
   * Reads one history list, newest first. The first page gives the count; the
   * remaining pages are requested a few at a time.
   */
  private async getHistory(
    getPage: (page: {
      limit: number;
      offset: number;
    }) => Promise<Page<ExecutedSafeCall>>,
  ): Promise<SafeCallHistory> {
    const firstPage = await getPage({ limit: HISTORY_PAGE_SIZE, offset: 0 });
    const count = firstPage.count ?? firstPage.results.length;
    const pages = Math.ceil(count / HISTORY_PAGE_SIZE);
    const offsets = Array.from(
      { length: Math.max(Math.min(pages, this.maxHistoryPages) - 1, 0) },
      (_, index) => (index + 1) * HISTORY_PAGE_SIZE,
    );

    const otherPages = await this.allFulfilled(
      batched(offsets, this.historyConcurrency, (offset) =>
        getPage({ limit: HISTORY_PAGE_SIZE, offset }),
      ),
    );

    return {
      calls: [firstPage, ...otherPages].flatMap((page) => page.results),
      isComplete: pages <= this.maxHistoryPages,
    };
  }

  /**
   * Splits the history into the approvals readable from calldata and the
   * transactions whose approvals can only be read from their events.
   */
  private findCalldataApprovals(calls: Array<ExecutedSafeCall>): {
    tokenSpenders: Array<TokenSpender>;
    transactionHashes: Array<Hex>;
  } {
    const tokenSpenders: Array<TokenSpender> = [];
    const transactionHashes = new Set<Hex>();

    for (const call of calls) {
      if (call.isSuccessful === false) {
        continue;
      }
      const approvals = this.tokenApprovalCallsHelper.findApprovals(call);
      tokenSpenders.push(...approvals.tokenSpenders);
      if (approvals.hasOpaqueDelegateCall && call.transactionHash) {
        transactionHashes.add(call.transactionHash);
      }
    }

    return { tokenSpenders, transactionHashes: [...transactionHashes] };
  }

  /** Reads the ERC-20 `Approval` events the given transactions emitted with the Safe as owner. */
  private async getEventTokenSpenders(args: {
    client: PublicClient;
    safeAddress: Address;
    transactionHashes: Array<Hex>;
  }): Promise<Array<TokenSpender>> {
    const receipts = await this.allFulfilled(
      batched(args.transactionHashes, this.receiptsConcurrency, (hash) =>
        args.client.getTransactionReceipt({ hash }),
      ),
    );

    return receipts.flatMap((receipt) =>
      parseEventLogs({
        abi: erc20Abi,
        eventName: 'Approval',
        logs: receipt.logs,
        args: { owner: args.safeAddress },
      }).map((log) => ({
        tokenAddress: getAddress(log.address),
        spender: log.args.spender,
      })),
    );
  }

  /**
   * Reads the current allowance of every pair and keeps those above zero.
   * A pair whose token does not answer `allowance` is not an ERC-20 and is dropped.
   */
  private async getLiveApprovals(args: {
    client: PublicClient;
    safeAddress: Address;
    tokenSpenders: Array<TokenSpender>;
  }): Promise<Array<TokenApproval>> {
    const tokenSpenders = uniqBy(
      args.tokenSpenders,
      ({ tokenAddress, spender }) => `${tokenAddress}:${spender}`,
    );
    if (tokenSpenders.length === 0) {
      return [];
    }

    const allowances = await args.client.multicall({
      allowFailure: true,
      multicallAddress: MULTICALL3_ADDRESS,
      batchSize: MULTICALL_BATCH_SIZE_BYTES,
      contracts: tokenSpenders.map(
        ({ tokenAddress, spender }) =>
          ({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [args.safeAddress, spender],
          }) as const,
      ),
    });

    return tokenSpenders.flatMap((tokenSpender, index) => {
      const allowance = allowances[index];
      return allowance.status === 'success' && allowance.result > 0n
        ? [{ ...tokenSpender, allowance: allowance.result }]
        : [];
    });
  }

  /** Unwraps batched results, failing the scan when any request failed: a partial scan would hide approvals. */
  private async allFulfilled<T>(
    results: Promise<Array<PromiseSettledResult<T>>>,
  ): Promise<Array<T>> {
    return (await results).map((result) => {
      if (result.status === 'rejected') {
        throw result.reason;
      }
      return result.value;
    });
  }
}
