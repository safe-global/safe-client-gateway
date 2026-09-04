// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { JobType } from '@/datasources/job-queue/types/job-types';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import type { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IBalancesRepository } from '@/modules/balances/domain/balances.repository.interface';
import { balanceBuilder } from '@/modules/balances/domain/entities/__tests__/balance.builder';
import type { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import type {
  ICloudCosignerRepository,
  ReviewResult,
} from '@/modules/cloud-cosigner/domain/cloud-cosigner.repository.interface';
import type { CloudCosignerPolicyService } from '@/modules/cloud-cosigner/domain/cloud-cosigner-policy.service';
import { CloudCosignerReviewService } from '@/modules/cloud-cosigner/domain/cloud-cosigner-review.service';
import { cloudCosignerPolicyBuilder } from '@/modules/cloud-cosigner/domain/entities/__tests__/cloud-cosigner-policy.builder';
import { cloudCosignerReviewBuilder } from '@/modules/cloud-cosigner/domain/entities/__tests__/cloud-cosigner-review.builder';
import { reviewVerdictBuilder } from '@/modules/cloud-cosigner/domain/entities/__tests__/review-verdict.builder';
import {
  type CloudCosignerReview,
  PolicyRule,
  ReviewMode,
  ReviewStatus,
} from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-review.entity';
import { Verdict } from '@/modules/cloud-cosigner/domain/entities/review-verdict.entity';
import type { ICosignerSigner } from '@/modules/cloud-cosigner/domain/signers/cosigner-signer.interface';
import type { TransactionReviewer } from '@/modules/cloud-cosigner/domain/transaction-reviewer.service';
import type { IDataDecoderRepository } from '@/modules/data-decoder/domain/v2/data-decoder.repository.interface';
import { multisigTransactionBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import type { Transaction } from '@/modules/safe/domain/entities/transaction.entity';
import type { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';

const mockLoggingService = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

const mockJobQueueService = {
  addJob: vi.fn(),
  getJob: vi.fn(),
} as MockedObject<IJobQueueService>;

const mockRepository = {
  getPolicy: vi.fn(),
  upsertPolicy: vi.fn(),
  getReview: vi.fn(),
  claimReview: vi.fn(),
  completeReview: vi.fn(),
  failReview: vi.fn(),
} as MockedObject<ICloudCosignerRepository>;

const mockPolicyService = {
  getEffectivePolicy: vi.fn(),
} as unknown as MockedObject<CloudCosignerPolicyService>;

const mockSigner = {
  getAddress: vi.fn(),
  signHash: vi.fn(),
} as MockedObject<ICosignerSigner>;

const mockSafeRepository = {
  getSafe: vi.fn(),
  clearMultisigTransaction: vi.fn(),
  getMultiSigTransaction: vi.fn(),
  getMultisigTransactions: vi.fn(),
  getTransactionHistory: vi.fn(),
  addConfirmation: vi.fn(),
} as unknown as MockedObject<ISafeRepository>;

const mockChainsRepository = {
  getChain: vi.fn(),
} as unknown as MockedObject<IChainsRepository>;

const mockBalancesRepository = {
  getBalances: vi.fn(),
} as unknown as MockedObject<IBalancesRepository>;

const mockDataDecoderRepository = {
  getDecodedData: vi.fn(),
  getTransactionDataDecoded: vi.fn(),
} as MockedObject<IDataDecoderRepository>;

const mockReviewer = {
  review: vi.fn(),
} as unknown as MockedObject<TransactionReviewer>;

function completedReview(
  id: number,
  result: ReviewResult,
): CloudCosignerReview {
  return cloudCosignerReviewBuilder()
    .with('id', id)
    .with('status', result.status)
    .with('mode', result.mode)
    .with('triggeredRules', result.triggeredRules)
    .with('summary', result.summary)
    .with('riskFlags', result.riskFlags)
    .with('model', result.model)
    .with('signature', result.signature)
    .build();
}

describe('CloudCosignerReviewService', () => {
  const cosigner = privateKeyToAccount(generatePrivateKey());
  const chainId = '1';
  const chain = chainBuilder().with('chainId', chainId).build();
  const reviewTimeoutMs = 300_000;
  const defaultPolicy = cloudCosignerPolicyBuilder()
    .with('valueThresholdUsd', 100_000)
    .with('reviewUnknownContracts', true)
    .with('instructions', null)
    .build();
  let service: CloudCosignerReviewService;
  let safe: Safe;

  function buildTransaction(
    overrides: (
      tx: ReturnType<typeof multisigTransactionBuilder>,
    ) => void = () => {},
  ): Promise<MultisigTransaction> {
    const builder = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .with('operation', Operation.CALL)
      .with('data', null)
      .with('value', '0');
    overrides(builder);
    return builder.buildWithConfirmations({ chainId, safe, signers: [] });
  }

  function claimed(id = faker.number.int()): void {
    mockRepository.claimReview.mockResolvedValue({
      claimed: true,
      review: cloudCosignerReviewBuilder()
        .with('id', id)
        .with('status', ReviewStatus.PENDING)
        .build(),
    });
  }

  beforeEach(() => {
    const configurationService = new FakeConfigurationService();
    configurationService.set('cloudCosigner.fiatCode', 'USD');
    configurationService.set('cloudCosigner.historyLookbackLimit', 20);
    configurationService.set(
      'cloudCosigner.reviewer.reviewTimeoutMs',
      reviewTimeoutMs,
    );
    service = new CloudCosignerReviewService(
      configurationService,
      mockLoggingService,
      mockJobQueueService,
      mockRepository,
      mockPolicyService,
      mockSigner,
      mockSafeRepository,
      mockChainsRepository,
      mockBalancesRepository,
      mockDataDecoderRepository,
      mockReviewer,
    );

    safe = safeBuilder()
      .with('version', '1.3.0')
      .with('nonce', 5)
      .with('owners', [
        cosigner.address,
        getAddress(faker.finance.ethereumAddress()),
      ])
      .build();
    mockSigner.getAddress.mockResolvedValue(cosigner.address);
    mockSigner.signHash.mockImplementation((hash) => cosigner.sign({ hash }));
    mockSafeRepository.getSafe.mockResolvedValue(safe);
    mockSafeRepository.clearMultisigTransaction.mockResolvedValue(undefined);
    mockSafeRepository.addConfirmation.mockResolvedValue(undefined);
    mockSafeRepository.getMultisigTransactions.mockResolvedValue(
      pageBuilder<MultisigTransaction>()
        .with('count', 0)
        .with('results', [])
        .build(),
    );
    mockSafeRepository.getTransactionHistory.mockResolvedValue(
      pageBuilder<Transaction>().with('results', []).build(),
    );
    mockChainsRepository.getChain.mockResolvedValue(chain);
    mockBalancesRepository.getBalances.mockResolvedValue([]);
    mockDataDecoderRepository.getTransactionDataDecoded.mockResolvedValue(null);
    mockPolicyService.getEffectivePolicy.mockResolvedValue(defaultPolicy);
    mockRepository.completeReview.mockImplementation(({ id, result }) =>
      Promise.resolve(completedReview(id, result)),
    );
  });

  describe('enqueueEvent', () => {
    it('should add a review job for the proposal', async () => {
      const safeTxHash = faker.string.hexadecimal({ length: 64 }) as Hex;

      await service.enqueueEvent({
        type: 'PENDING_MULTISIG_TRANSACTION',
        chainId,
        address: safe.address,
        safeTxHash,
      });

      expect(mockJobQueueService.addJob).toHaveBeenCalledWith(
        JobType.CLOUD_COSIGNER_REVIEW,
        { chainId, safeAddress: safe.address, safeTxHash },
      );
    });

    it('should log and swallow queue failures', async () => {
      mockJobQueueService.addJob.mockRejectedValue(new Error('redis down'));

      await expect(
        service.enqueueEvent({
          type: 'PENDING_MULTISIG_TRANSACTION',
          chainId,
          address: safe.address,
          safeTxHash: faker.string.hexadecimal({ length: 64 }) as Hex,
        }),
      ).resolves.toBeUndefined();

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to enqueue review: redis down',
        }),
      );
    });
  });

  describe('processReview', () => {
    it('should do nothing for a Safe the cosigner does not own', async () => {
      mockSafeRepository.getSafe.mockResolvedValue(
        safeBuilder()
          .with('owners', [getAddress(faker.finance.ethereumAddress())])
          .build(),
      );

      const outcome = await service.processReview({
        chainId,
        safeAddress: safe.address,
        safeTxHash: faker.string.hexadecimal({ length: 64 }) as Hex,
      });

      expect(outcome).toStrictEqual({ kind: 'not_enrolled' });
      expect(mockRepository.claimReview).not.toHaveBeenCalled();
    });

    it('should stop when the review was already handled', async () => {
      const existing = cloudCosignerReviewBuilder()
        .with('status', ReviewStatus.REJECTED)
        .build();
      mockRepository.claimReview.mockResolvedValue({
        claimed: false,
        review: existing,
      });

      const outcome = await service.processReview({
        chainId,
        safeAddress: safe.address,
        safeTxHash: existing.safeTxHash,
      });

      expect(outcome).toStrictEqual({
        kind: 'already_handled',
        status: ReviewStatus.REJECTED,
      });
      expect(mockRepository.claimReview).toHaveBeenCalledWith({
        chainId,
        safeAddress: safe.address,
        safeTxHash: existing.safeTxHash,
        stalePendingAfterMs: 2 * reviewTimeoutMs,
      });
      expect(mockSafeRepository.getMultiSigTransaction).not.toHaveBeenCalled();
    });

    it('should skip an executed transaction without signing', async () => {
      const transaction = await buildTransaction((tx) =>
        tx.with('isExecuted', true),
      );
      claimed();
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(transaction);

      const outcome = await service.processReview({
        chainId,
        safeAddress: safe.address,
        safeTxHash: transaction.safeTxHash,
      });

      expect(outcome).toMatchObject({
        kind: 'reviewed',
        review: {
          status: ReviewStatus.SKIPPED,
          summary: 'Transaction already executed.',
        },
      });
      expect(mockSigner.signHash).not.toHaveBeenCalled();
    });

    it('should skip a transaction below the current nonce', async () => {
      const transaction = await buildTransaction((tx) =>
        tx.with('nonce', safe.nonce - 1),
      );
      claimed();
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(transaction);

      const outcome = await service.processReview({
        chainId,
        safeAddress: safe.address,
        safeTxHash: transaction.safeTxHash,
      });

      expect(outcome).toMatchObject({
        review: {
          status: ReviewStatus.SKIPPED,
          summary: 'Transaction nonce is below the current Safe nonce.',
        },
      });
    });

    it('should skip when the cosigner already confirmed', async () => {
      const transaction = await buildTransaction();
      transaction.confirmations = [
        {
          owner: cosigner.address,
          signature: null,
          signatureType: SignatureType.Eoa,
          submissionDate: faker.date.recent(),
          transactionHash: null,
        },
      ];
      claimed();
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(transaction);

      const outcome = await service.processReview({
        chainId,
        safeAddress: safe.address,
        safeTxHash: transaction.safeTxHash,
      });

      expect(outcome).toMatchObject({
        review: {
          status: ReviewStatus.SKIPPED,
          summary: 'Cosigner already confirmed.',
        },
      });
      expect(mockSigner.signHash).not.toHaveBeenCalled();
    });

    it('should reject a transaction whose hash does not match its contents', async () => {
      const transaction = await buildTransaction();
      const forged = { ...transaction, value: '1' };
      claimed();
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(forged);

      const outcome = await service.processReview({
        chainId,
        safeAddress: safe.address,
        safeTxHash: transaction.safeTxHash,
      });

      expect(outcome).toMatchObject({
        review: {
          status: ReviewStatus.REJECTED,
          riskFlags: ['hash_mismatch'],
          signature: null,
        },
      });
      expect(mockSigner.signHash).not.toHaveBeenCalled();
      expect(mockReviewer.review).not.toHaveBeenCalled();
    });

    it('should sign on the fast path when no rule triggers', async () => {
      // A plain native transfer well below the threshold to an EOA.
      const transaction = await buildTransaction((tx) =>
        tx.with('value', '1000'),
      );
      mockBalancesRepository.getBalances.mockResolvedValue([
        balanceBuilder()
          .with('tokenAddress', null)
          .with('token', null)
          .with('fiatConversion', '2000')
          .build(),
      ]);
      claimed(7);
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(transaction);

      const outcome = await service.processReview({
        chainId,
        safeAddress: safe.address,
        safeTxHash: transaction.safeTxHash,
      });

      const signature = await cosigner.sign({ hash: transaction.safeTxHash });
      expect(outcome).toMatchObject({
        kind: 'reviewed',
        review: {
          status: ReviewStatus.APPROVED,
          mode: ReviewMode.RULES,
          signature,
        },
      });
      expect(mockSafeRepository.addConfirmation).toHaveBeenCalledWith({
        chainId,
        safeTxHash: transaction.safeTxHash,
        addConfirmationDto: { signature },
      });
      expect(mockRepository.completeReview).toHaveBeenCalledWith({
        id: 7,
        result: expect.objectContaining({
          status: ReviewStatus.APPROVED,
          mode: ReviewMode.RULES,
          triggeredRules: [],
          signature,
        }),
      });
      expect(mockReviewer.review).not.toHaveBeenCalled();
      expect(mockSafeRepository.clearMultisigTransaction).toHaveBeenCalledWith({
        chainId,
        safeTransactionHash: transaction.safeTxHash,
      });
      expect(mockBalancesRepository.getBalances).toHaveBeenCalledWith({
        chain,
        safeAddress: safe.address,
        fiatCode: 'USD',
        trusted: false,
        excludeSpam: false,
      });
    });

    it('should ask the reviewer and withhold the signature on a reject verdict', async () => {
      // An unpriced native transfer: UNKNOWN_VALUE triggers.
      const transaction = await buildTransaction((tx) =>
        tx.with('value', '1000'),
      );
      claimed();
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(transaction);
      const verdict = reviewVerdictBuilder()
        .with('verdict', Verdict.REJECT)
        .with('risk_flags', ['address_poisoning'])
        .build();
      mockReviewer.review.mockResolvedValue({
        kind: 'verdict',
        verdict,
        model: 'claude-opus-5',
      });

      const outcome = await service.processReview({
        chainId,
        safeAddress: safe.address,
        safeTxHash: transaction.safeTxHash,
      });

      expect(mockReviewer.review).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId,
          chainName: chain.chainName,
          safe,
          cosignerAddress: cosigner.address,
          policy: defaultPolicy,
          transaction,
          evaluation: expect.objectContaining({
            triggeredRules: [PolicyRule.UNKNOWN_VALUE],
          }),
        }),
      );
      expect(mockSigner.signHash).not.toHaveBeenCalled();
      expect(mockSafeRepository.addConfirmation).not.toHaveBeenCalled();
      expect(outcome).toMatchObject({
        review: {
          status: ReviewStatus.REJECTED,
          mode: ReviewMode.LLM,
          triggeredRules: [PolicyRule.UNKNOWN_VALUE],
          summary: verdict.summary,
          riskFlags: ['address_poisoning'],
          model: 'claude-opus-5',
          signature: null,
        },
      });
    });

    it('should sign after an approve verdict', async () => {
      const transaction = await buildTransaction((tx) =>
        tx.with('value', '1000'),
      );
      claimed();
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(transaction);
      mockReviewer.review.mockResolvedValue({
        kind: 'verdict',
        verdict: reviewVerdictBuilder()
          .with('verdict', Verdict.APPROVE)
          .build(),
        model: 'claude-opus-5',
      });

      const outcome = await service.processReview({
        chainId,
        safeAddress: safe.address,
        safeTxHash: transaction.safeTxHash,
      });

      expect(outcome).toMatchObject({
        review: { status: ReviewStatus.APPROVED, mode: ReviewMode.LLM },
      });
      expect(mockSafeRepository.addConfirmation).toHaveBeenCalledTimes(1);
    });

    it('should withhold the signature when the reviewer refuses', async () => {
      const transaction = await buildTransaction((tx) =>
        tx.with('value', '1000'),
      );
      claimed();
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(transaction);
      mockReviewer.review.mockResolvedValue({
        kind: 'refusal',
        category: 'cyber',
        model: 'claude-opus-5',
      });

      const outcome = await service.processReview({
        chainId,
        safeAddress: safe.address,
        safeTxHash: transaction.safeTxHash,
      });

      expect(mockSafeRepository.addConfirmation).not.toHaveBeenCalled();
      expect(outcome).toMatchObject({
        review: {
          status: ReviewStatus.REJECTED,
          riskFlags: ['refusal:cyber'],
        },
      });
    });

    it('should mark the review failed and rethrow when a dependency fails', async () => {
      const transaction = await buildTransaction((tx) =>
        tx.with('value', '1000'),
      );
      claimed(3);
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(transaction);
      mockReviewer.review.mockRejectedValue(new Error('model timeout'));

      await expect(
        service.processReview({
          chainId,
          safeAddress: safe.address,
          safeTxHash: transaction.safeTxHash,
        }),
      ).rejects.toThrow('model timeout');

      expect(mockRepository.failReview).toHaveBeenCalledWith({
        id: 3,
        summary: 'model timeout',
      });
      expect(mockSafeRepository.addConfirmation).not.toHaveBeenCalled();
    });

    it('should route to review when balances are unavailable', async () => {
      const transaction = await buildTransaction((tx) =>
        tx.with('value', '1000'),
      );
      claimed();
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(transaction);
      mockBalancesRepository.getBalances.mockRejectedValue(
        new Error('prices down'),
      );
      mockReviewer.review.mockResolvedValue({
        kind: 'verdict',
        verdict: reviewVerdictBuilder().with('verdict', Verdict.REJECT).build(),
        model: 'claude-opus-5',
      });

      await service.processReview({
        chainId,
        safeAddress: safe.address,
        safeTxHash: transaction.safeTxHash,
      });

      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Balances unavailable: prices down',
        }),
      );
      expect(mockReviewer.review).toHaveBeenCalledWith(
        expect.objectContaining({
          evaluation: expect.objectContaining({
            triggeredRules: [PolicyRule.UNKNOWN_VALUE],
          }),
        }),
      );
    });

    it('should treat a contract with executed history as known', async () => {
      const contract = getAddress(faker.finance.ethereumAddress());
      const transaction = await buildTransaction((tx) =>
        tx.with('to', contract).with('data', '0x12345678'),
      );
      mockSafeRepository.getMultisigTransactions.mockResolvedValue(
        pageBuilder<MultisigTransaction>().with('count', 3).build(),
      );
      claimed();
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(transaction);

      const outcome = await service.processReview({
        chainId,
        safeAddress: safe.address,
        safeTxHash: transaction.safeTxHash,
      });

      expect(mockSafeRepository.getMultisigTransactions).toHaveBeenCalledWith({
        chainId,
        safeAddress: safe.address,
        to: contract,
        executed: true,
        limit: 1,
      });
      expect(outcome).toMatchObject({
        review: { status: ReviewStatus.APPROVED, mode: ReviewMode.RULES },
      });
    });
  });
});
