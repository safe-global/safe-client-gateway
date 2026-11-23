// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type Address, decodeEventLog, erc20Abi, size } from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import { TokenApprovalsApi } from '#/modules/token-approvals/datasources/token-approvals-api.service';
import { AllowanceReadSchema } from '#/modules/token-approvals/domain/entities/allowance-read.entity';
import {
  type ApprovalLog,
  ApprovalLogSchema,
} from '#/modules/token-approvals/domain/entities/approval-log.entity';
import { BlockNumberSchema } from '#/modules/token-approvals/domain/entities/block-number.entity';
import type {
  TokenApproval,
  TokenApprovals,
  TokenSpender,
} from '#/modules/token-approvals/domain/entities/token-approval.entity';
import {
  type TokenApprovalsScanState,
  TokenApprovalsScanStateSchema,
} from '#/modules/token-approvals/domain/entities/token-approvals-scan-state.entity';
import {
  ERC20_APPROVAL_DATA_BYTES,
  ERC20_APPROVAL_TOPIC_COUNT,
  RESCAN_BLOCKS,
} from '#/modules/token-approvals/domain/token-approvals.constants';
import type { ITokenApprovalsRepository } from '#/modules/token-approvals/domain/token-approvals.repository.interface';
import type { Raw } from '#/validation/entities/raw.entity';

@Injectable()
export class TokenApprovalsRepository implements ITokenApprovalsRepository {
  private readonly maxLogsRequests: number;
  private readonly maxPairs: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    private readonly tokenApprovalsApi: TokenApprovalsApi,
  ) {
    this.maxLogsRequests = this.configurationService.getOrThrow<number>(
      'tokenApprovals.logs.maxRequests',
    );
    this.maxPairs = this.configurationService.getOrThrow<number>(
      'tokenApprovals.maxPairs',
    );
  }

  async getTokenApprovals(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<TokenApprovals> {
    const [head, storedState] = await Promise.all([
      this.getHeadBlockNumber(args.chainId),
      this.getScanState(args),
    ]);
    const state = await this.scanApprovalLogs({
      ...args,
      head,
      state: storedState,
    });
    await this.tokenApprovalsApi.setScanState({
      ...args,
      state: { ...state, lastScannedBlock: this.storedProgress(state, head) },
    });
    const approvals = await this.getLiveApprovals({
      ...args,
      pairs: state.pairs,
      blockNumber: head,
    });

    return {
      approvals,
      isComplete:
        !state.hasDroppedPairs &&
        state.lastScannedBlock !== null &&
        state.lastScannedBlock >= head,
    };
  }

  private async getHeadBlockNumber(chainId: string): Promise<number> {
    const head = await this.tokenApprovalsApi.getHeadBlockNumber(chainId);
    return BlockNumberSchema.parse(head);
  }

  /** The stored scan state; a new one when none is stored or it does not parse. */
  private async getScanState(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<TokenApprovalsScanState> {
    const stored = await this.tokenApprovalsApi.getScanState(args);
    const result = TokenApprovalsScanStateSchema.safeParse(stored);
    if (result.success) {
      return result.data;
    }
    if (stored !== null) {
      this.loggingService.debug({
        message: 'Discarded a token approvals scan state that does not parse',
        chainId: args.chainId,
        safeAddress: args.safeAddress,
      });
    }
    return {
      pairs: [],
      lastScannedBlock: null,
      rangeSize: null,
      hasDroppedPairs: false,
    };
  }

  /**
   * Providers limit `eth_getLogs` in different ways, so the range adapts: it is
   * halved when rejected and doubled after it works. When the request budget
   * runs out, or a single block is rejected, the progress so far is kept for
   * the next request.
   */
  private async scanApprovalLogs(args: {
    chainId: string;
    safeAddress: Address;
    head: number;
    state: TokenApprovalsScanState;
  }): Promise<TokenApprovalsScanState> {
    let state = args.state;
    let rangeSize = Math.min(
      state.rangeSize ?? Number.POSITIVE_INFINITY,
      this.blocksLeft(state, args.head),
    );

    for (
      let requests = 0;
      requests < this.maxLogsRequests && this.blocksLeft(state, args.head) > 0;
      requests++
    ) {
      const fromBlock = this.nextBlock(state);
      const toBlock = fromBlock + rangeSize - 1;
      let logs: Raw<Array<ApprovalLog>>;
      try {
        logs = await this.tokenApprovalsApi.getApprovalLogs({
          chainId: args.chainId,
          owner: args.safeAddress,
          fromBlock,
          toBlock,
        });
      } catch (error) {
        this.loggingService.debug({
          message: 'Could not read a range of Approval logs',
          chainId: args.chainId,
          fromBlock,
          toBlock,
          error: asError(error).message,
        });
        if (rangeSize > 1) {
          rangeSize = Math.floor(rangeSize / 2);
          continue;
        }
        const hasScannedAnyBlock =
          state.lastScannedBlock !== args.state.lastScannedBlock;
        if (!hasScannedAnyBlock) {
          throw error;
        }
        break;
      }

      state = {
        ...this.withPairs(state, this.pairsOf(logs)),
        lastScannedBlock: toBlock,
        rangeSize,
      };
      rangeSize = Math.min(rangeSize * 2, this.blocksLeft(state, args.head));
    }

    return state;
  }

  private storedProgress(
    state: TokenApprovalsScanState,
    head: number,
  ): number | null {
    if (state.lastScannedBlock === null) {
      return null;
    }
    const progress = Math.min(state.lastScannedBlock, head - RESCAN_BLOCKS);
    return progress >= 0 ? progress : null;
  }

  private nextBlock(state: TokenApprovalsScanState): number {
    return state.lastScannedBlock === null ? 0 : state.lastScannedBlock + 1;
  }

  private blocksLeft(state: TokenApprovalsScanState, head: number): number {
    return head - this.nextBlock(state) + 1;
  }

  private pairsOf(logs: Raw<Array<ApprovalLog>>): Array<TokenSpender> {
    return ApprovalLogSchema.array()
      .parse(logs)
      .filter((log) => this.isErc20Approval(log))
      .map((log) => {
        const { args } = decodeEventLog({
          abi: erc20Abi,
          eventName: 'Approval',
          topics: log.topics,
          data: log.data,
        });
        return { tokenAddress: log.address, spender: args.spender };
      });
  }

  /** ERC-721 emits the same event with the token id as a fourth topic. */
  private isErc20Approval(log: ApprovalLog): boolean {
    return (
      log.topics.length === ERC20_APPROVAL_TOPIC_COUNT &&
      size(log.data) === ERC20_APPROVAL_DATA_BYTES
    );
  }

  private withPairs(
    state: TokenApprovalsScanState,
    found: Array<TokenSpender>,
  ): Pick<TokenApprovalsScanState, 'pairs' | 'hasDroppedPairs'> {
    const pairs = [...state.pairs];
    const keys = new Set(pairs.map((pair) => this.keyOf(pair)));
    let hasDroppedPairs = state.hasDroppedPairs;

    for (const pair of found) {
      const key = this.keyOf(pair);
      if (keys.has(key)) {
        continue;
      }
      if (pairs.length >= this.maxPairs) {
        hasDroppedPairs = true;
        continue;
      }
      pairs.push(pair);
      keys.add(key);
    }

    return { pairs, hasDroppedPairs };
  }

  private keyOf(pair: TokenSpender): string {
    return `${pair.tokenAddress}:${pair.spender}`;
  }

  /**
   * Reads the allowance of every pair at {@link args.blockNumber} and keeps
   * those above zero. A pair whose token does not answer `allowance` is not an
   * ERC-20 and is dropped.
   */
  private async getLiveApprovals(args: {
    chainId: string;
    safeAddress: Address;
    pairs: Array<TokenSpender>;
    blockNumber: number;
  }): Promise<Array<TokenApproval>> {
    if (args.pairs.length === 0) {
      return [];
    }

    const allowances = await this.tokenApprovalsApi.getAllowances({
      chainId: args.chainId,
      owner: args.safeAddress,
      pairs: args.pairs,
      blockNumber: args.blockNumber,
    });
    const reads = AllowanceReadSchema.array()
      .length(args.pairs.length)
      .parse(allowances);

    return args.pairs.flatMap((pair, index) => {
      const read = reads[index];
      return read.status === 'success' && read.result > BigInt(0)
        ? [{ ...pair, allowance: read.result }]
        : [];
    });
  }
}
