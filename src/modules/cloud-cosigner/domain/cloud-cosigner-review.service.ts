// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type Address, type Hex, isAddressEqual, size, slice } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { JobType } from '@/datasources/job-queue/types/job-types';
import { LogType } from '@/domain/common/entities/log-type.entity';
import {
  getMultiSendCallOnlyDeployments,
  getMultiSendDeployments,
} from '@/domain/common/utils/deployments';
import {
  getBaseMultisigTransaction,
  getSafeTxHash,
} from '@/domain/common/utils/safe';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { IBalancesRepository } from '@/modules/balances/domain/balances.repository.interface';
import type { Balance } from '@/modules/balances/domain/entities/balance.entity';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import {
  ICloudCosignerRepository,
  type ReviewResult,
} from '@/modules/cloud-cosigner/domain/cloud-cosigner.repository.interface';
import { CloudCosignerPolicyService } from '@/modules/cloud-cosigner/domain/cloud-cosigner-policy.service';
import type { CloudCosignerReviewJobData } from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-job.entity';
import {
  type CloudCosignerReview,
  ReviewMode,
  ReviewStatus,
} from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-review.entity';
import type { PendingTransactionEvent } from '@/modules/cloud-cosigner/domain/entities/pending-transaction-event.entity';
import type { ProcessOutcome } from '@/modules/cloud-cosigner/domain/entities/process-outcome.entity';
import type { HistoryEntry } from '@/modules/cloud-cosigner/domain/entities/review-input.entity';
import { Verdict } from '@/modules/cloud-cosigner/domain/entities/review-verdict.entity';
import { evaluatePolicy } from '@/modules/cloud-cosigner/domain/policy-evaluator';
import { ICosignerSigner } from '@/modules/cloud-cosigner/domain/signers/cosigner-signer.interface';
import {
  analyzeTransaction,
  getCalledContracts,
  valueTransaction,
} from '@/modules/cloud-cosigner/domain/transaction-analysis';
import { TransactionReviewer } from '@/modules/cloud-cosigner/domain/transaction-reviewer.service';
import { IDataDecoderRepository } from '@/modules/data-decoder/domain/v2/data-decoder.repository.interface';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import { isMultisigTransaction } from '@/modules/safe/domain/entities/transaction.entity';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';

// Versions of the MultiSend contracts a delegatecall may legitimately target.
const MULTI_SEND_VERSIONS = ['1.3.0', '1.4.1'];
// Upper bound on per-contract history lookups for one transaction.
const MAX_CONTRACT_LOOKUPS = 10;
const SELECTOR_BYTES = 4;
// A pending review that outlives this many model timeouts is reclaimed.
const STALE_PENDING_TIMEOUTS = 2;

/**
 * Worker side of the cosigner: turns a proposal event into a review job and
 * runs the job. Everything before the claim is side-effect free, so the many
 * Safes that do not use the cosigner never touch the database.
 */
@Injectable()
export class CloudCosignerReviewService {
  private readonly fiatCode: string;
  private readonly historyLookbackLimit: number;
  private readonly stalePendingAfterMs: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IJobQueueService)
    private readonly jobQueueService: IJobQueueService,
    @Inject(ICloudCosignerRepository)
    private readonly cloudCosignerRepository: ICloudCosignerRepository,
    @Inject(CloudCosignerPolicyService)
    private readonly policyService: CloudCosignerPolicyService,
    @Inject(ICosignerSigner) private readonly signer: ICosignerSigner,
    @Inject(ISafeRepository) private readonly safeRepository: ISafeRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(IBalancesRepository)
    private readonly balancesRepository: IBalancesRepository,
    @Inject(IDataDecoderRepository)
    private readonly dataDecoderRepository: IDataDecoderRepository,
    @Inject(TransactionReviewer)
    private readonly transactionReviewer: TransactionReviewer,
  ) {
    this.fiatCode = this.configurationService.getOrThrow<string>(
      'cloudCosigner.fiatCode',
    );
    this.historyLookbackLimit = this.configurationService.getOrThrow<number>(
      'cloudCosigner.historyLookbackLimit',
    );
    this.stalePendingAfterMs =
      STALE_PENDING_TIMEOUTS *
      this.configurationService.getOrThrow<number>(
        'cloudCosigner.reviewer.reviewTimeoutMs',
      );
  }

  /**
   * Hook-path entry point: cheap and never throwing, so a queue outage can
   * not take the subscriber down with it.
   */
  public async enqueueEvent(event: PendingTransactionEvent): Promise<void> {
    const data: CloudCosignerReviewJobData = {
      chainId: event.chainId,
      safeAddress: event.address,
      safeTxHash: event.safeTxHash,
    };
    try {
      await this.jobQueueService.addJob(JobType.CLOUD_COSIGNER_REVIEW, data);
    } catch (error) {
      this.loggingService.error({
        type: LogType.CloudCosignerEvent,
        message: `Failed to enqueue review: ${asError(error).message}`,
        ...data,
      });
    }
  }

  public async processReview(
    data: CloudCosignerReviewJobData,
  ): Promise<ProcessOutcome> {
    const cosignerAddress = await this.signer.getAddress();
    const safe = await this.safeRepository.getSafe({
      chainId: data.chainId,
      address: data.safeAddress,
    });
    if (!safe.owners.some((owner) => isAddressEqual(owner, cosignerAddress))) {
      return { kind: 'not_enrolled' };
    }

    const claim = await this.cloudCosignerRepository.claimReview({
      ...data,
      stalePendingAfterMs: this.stalePendingAfterMs,
    });
    if (!claim.claimed) {
      return { kind: 'already_handled', status: claim.review.status };
    }

    try {
      const review = await this.reviewClaimed({
        reviewId: claim.review.id,
        cosignerAddress,
        safe,
        data,
      });
      this.loggingService.info({
        type: LogType.CloudCosignerReview,
        chainId: data.chainId,
        safeAddress: data.safeAddress,
        safeTxHash: data.safeTxHash,
        status: review.status,
        mode: review.mode,
        triggeredRules: review.triggeredRules,
      });
      return { kind: 'reviewed', review };
    } catch (error) {
      await this.cloudCosignerRepository.failReview({
        id: claim.review.id,
        summary: asError(error).message,
      });
      throw error;
    }
  }

  private async reviewClaimed(args: {
    reviewId: CloudCosignerReview['id'];
    cosignerAddress: Address;
    safe: Safe;
    data: CloudCosignerReviewJobData;
  }): Promise<CloudCosignerReview> {
    const { chainId, safeAddress, safeTxHash } = args.data;
    // The gateway process may still hold a negative cache entry for a
    // transaction proposed a moment ago; both processes share Redis.
    await this.safeRepository.clearMultisigTransaction({
      chainId,
      safeTransactionHash: safeTxHash,
    });
    const transaction = await this.safeRepository.getMultiSigTransaction({
      chainId,
      safeTransactionHash: safeTxHash,
    });

    const skipReason = this.getSkipReason({
      transaction,
      safe: args.safe,
      cosignerAddress: args.cosignerAddress,
    });
    if (skipReason) {
      return this.complete(args.reviewId, {
        status: ReviewStatus.SKIPPED,
        mode: null,
        triggeredRules: [],
        summary: skipReason,
        riskFlags: [],
        model: null,
        signature: null,
      });
    }

    if (
      !this.hasConsistentHash({
        chainId,
        transaction,
        safe: args.safe,
        safeTxHash,
      })
    ) {
      return this.complete(args.reviewId, {
        status: ReviewStatus.REJECTED,
        mode: ReviewMode.RULES,
        triggeredRules: [],
        summary:
          'The transaction hash reported by the Transaction Service does not match the transaction contents.',
        riskFlags: ['hash_mismatch'],
        model: null,
        signature: null,
      });
    }

    const chain = await this.chainsRepository.getChain(chainId);
    const [policy, dataDecoded, balances] = await Promise.all([
      this.policyService.getEffectivePolicy({ chainId, safeAddress }),
      this.dataDecoderRepository.getTransactionDataDecoded({
        chainId,
        transaction,
      }),
      this.getBalances({ chain, safeAddress }),
    ]);
    const analysis = analyzeTransaction({ transaction, dataDecoded });
    const valuation = valueTransaction({ analysis, balances, chain });
    const knownContracts = await this.getKnownContracts({
      chainId,
      safeAddress,
      candidates: getCalledContracts(analysis),
    });
    const evaluation = evaluatePolicy({
      policy,
      analysis,
      valuation,
      safeAddress,
      knownContracts,
      allowedDelegateCallTargets: this.getMultiSendAddresses(chainId),
      fiatCode: this.fiatCode,
    });

    if (evaluation.triggeredRules.length === 0) {
      const signature = await this.confirm({ chainId, transaction });
      return this.complete(args.reviewId, {
        status: ReviewStatus.APPROVED,
        mode: ReviewMode.RULES,
        triggeredRules: [],
        summary: 'No policy rule matched; signed on the fast path.',
        riskFlags: [],
        model: null,
        signature,
      });
    }

    const history = await this.getHistory({ chainId, safeAddress });
    const outcome = await this.transactionReviewer.review({
      chainId,
      chainName: chain.chainName,
      fiatCode: this.fiatCode,
      safe: args.safe,
      cosignerAddress: args.cosignerAddress,
      policy,
      transaction,
      dataDecoded,
      valuation,
      evaluation,
      knownContracts,
      history,
    });

    if (outcome.kind === 'refusal') {
      return this.complete(args.reviewId, {
        status: ReviewStatus.REJECTED,
        mode: ReviewMode.LLM,
        triggeredRules: evaluation.triggeredRules,
        summary:
          'The reviewer declined to assess this transaction, so the cosigner withholds its signature.',
        riskFlags: outcome.category ? [`refusal:${outcome.category}`] : [],
        model: outcome.model,
        signature: null,
      });
    }

    const isApproved = outcome.verdict.verdict === Verdict.APPROVE;
    const signature = isApproved
      ? await this.confirm({ chainId, transaction })
      : null;
    return this.complete(args.reviewId, {
      status: isApproved ? ReviewStatus.APPROVED : ReviewStatus.REJECTED,
      mode: ReviewMode.LLM,
      triggeredRules: evaluation.triggeredRules,
      summary: outcome.verdict.summary,
      riskFlags: outcome.verdict.risk_flags,
      model: outcome.model,
      signature,
    });
  }

  private getSkipReason(args: {
    transaction: MultisigTransaction;
    safe: Safe;
    cosignerAddress: Address;
  }): string | null {
    if (args.transaction.isExecuted) {
      return 'Transaction already executed.';
    }
    if (args.transaction.nonce < args.safe.nonce) {
      return 'Transaction nonce is below the current Safe nonce.';
    }
    const hasConfirmed = (args.transaction.confirmations ?? []).some((c) =>
      isAddressEqual(c.owner, args.cosignerAddress),
    );
    return hasConfirmed ? 'Cosigner already confirmed.' : null;
  }

  /**
   * The hash the cosigner signs must be the hash of what it reviewed: it is
   * recomputed from the transaction fields and compared against both the
   * Transaction Service's value and the one the event carried.
   */
  private hasConsistentHash(args: {
    chainId: string;
    transaction: MultisigTransaction;
    safe: Safe;
    safeTxHash: Hex;
  }): boolean {
    const expected = getSafeTxHash({
      chainId: args.chainId,
      transaction: getBaseMultisigTransaction(args.transaction),
      safe: args.safe,
    }).toLowerCase();
    return (
      expected === args.transaction.safeTxHash.toLowerCase() &&
      expected === args.safeTxHash.toLowerCase()
    );
  }

  private async confirm(args: {
    chainId: string;
    transaction: MultisigTransaction;
  }): Promise<Hex> {
    const signature = await this.signer.signHash(args.transaction.safeTxHash);
    await this.safeRepository.addConfirmation({
      chainId: args.chainId,
      safeTxHash: args.transaction.safeTxHash,
      addConfirmationDto: { signature },
    });
    return signature;
  }

  private complete(
    id: CloudCosignerReview['id'],
    result: ReviewResult,
  ): Promise<CloudCosignerReview> {
    return this.cloudCosignerRepository.completeReview({ id, result });
  }

  private async getBalances(args: {
    chain: Chain;
    safeAddress: Address;
  }): Promise<Array<Balance>> {
    try {
      return await this.balancesRepository.getBalances({
        chain: args.chain,
        safeAddress: args.safeAddress,
        fiatCode: this.fiatCode,
        trusted: false,
        excludeSpam: false,
      });
    } catch (error) {
      // Without prices every leg is an unknown value, which routes the
      // transaction to review rather than letting it through unpriced.
      this.loggingService.warn({
        type: LogType.CloudCosignerReview,
        message: `Balances unavailable: ${asError(error).message}`,
        chainId: args.chain.chainId,
        safeAddress: args.safeAddress,
      });
      return [];
    }
  }

  private async getKnownContracts(args: {
    chainId: string;
    safeAddress: Address;
    candidates: Array<Address>;
  }): Promise<Array<Address>> {
    const checks = args.candidates
      .slice(0, MAX_CONTRACT_LOOKUPS)
      .map(async (contract) => {
        const page = await this.safeRepository.getMultisigTransactions({
          chainId: args.chainId,
          safeAddress: args.safeAddress,
          to: contract,
          executed: true,
          limit: 1,
        });
        return page.count && page.count > 0 ? contract : null;
      });
    const results = await Promise.all(checks);
    return results.filter((contract): contract is Address => contract !== null);
  }

  private async getHistory(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<Array<HistoryEntry>> {
    try {
      const page = await this.safeRepository.getTransactionHistory({
        ...args,
        limit: this.historyLookbackLimit,
      });
      return page.results.filter(isMultisigTransaction).map((tx) => ({
        to: tx.to,
        value: tx.value,
        selector:
          tx.data && size(tx.data) >= SELECTOR_BYTES
            ? slice(tx.data, 0, SELECTOR_BYTES)
            : null,
        operation: tx.operation,
        executionDate: tx.executionDate,
      }));
    } catch (error) {
      // History is context, not a gate: the review proceeds without it.
      this.loggingService.warn({
        type: LogType.CloudCosignerReview,
        message: `History unavailable: ${asError(error).message}`,
        ...args,
      });
      return [];
    }
  }

  private getMultiSendAddresses(chainId: string): Array<Address> {
    return MULTI_SEND_VERSIONS.flatMap((version) => [
      ...getMultiSendDeployments({ chainId, version }),
      ...getMultiSendCallOnlyDeployments({ chainId, version }),
    ]);
  }
}
