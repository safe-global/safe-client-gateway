// SPDX-License-Identifier: FSL-1.1-MIT
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { type Hex, recoverAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { MockedObject } from 'vitest';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { CLOUD_COSIGNER_QUEUE } from '@/domain/common/jobs.constants';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import {
  bootCosignerTestApp,
  type CosignerTestApp,
} from '@/modules/cloud-cosigner/__tests__/cosigner-test-app';
import { AnthropicApi } from '@/modules/cloud-cosigner/datasources/anthropic-api.service';
import {
  type ICloudCosignerRepository,
  ICloudCosignerRepository as ICloudCosignerRepositoryToken,
} from '@/modules/cloud-cosigner/domain/cloud-cosigner.repository.interface';
import { CloudCosignerReviewService } from '@/modules/cloud-cosigner/domain/cloud-cosigner-review.service';
import { reviewVerdictBuilder } from '@/modules/cloud-cosigner/domain/entities/__tests__/review-verdict.builder';
import {
  type CloudCosignerReview,
  PolicyRule,
  ReviewMode,
  ReviewStatus,
} from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-review.entity';
import { Verdict } from '@/modules/cloud-cosigner/domain/entities/review-verdict.entity';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import { rawify } from '@/validation/entities/raw.entity';

const mockAnthropicApi = {
  review: vi.fn(),
} as unknown as MockedObject<AnthropicApi>;

const REVIEW_TIMEOUT_MS = 20_000;

/**
 * Runs a proposal through the real queue, worker, repository, signer and
 * confirmation path. Only the upstream HTTP client and the model are doubles,
 * so this is the check that the cosigner's signature is one the gateway's own
 * `TransactionVerifierHelper` accepts.
 */
describe('CloudCosignerReviewService (worker)', () => {
  let testApp: CosignerTestApp;
  let networkService: MockedObject<INetworkService>;
  let reviewService: CloudCosignerReviewService;
  let repository: ICloudCosignerRepository;
  let safeConfigUrl: string;
  let cosignerAddress: `0x${string}`;

  const owner = privateKeyToAccount(generatePrivateKey());
  const chain = chainBuilder().with('chainId', '1').build();

  beforeAll(async () => {
    testApp = await bootCosignerTestApp((builder) =>
      builder.overrideProvider(AnthropicApi).useValue(mockAnthropicApi),
    );
    cosignerAddress = privateKeyToAccount(
      testApp.configuration.cloudCosigner.signer.privateKey as `0x${string}`,
    ).address;
    safeConfigUrl = testApp.moduleFixture
      .get<IConfigurationService>(IConfigurationService)
      .getOrThrow('safeConfig.baseUri');
    networkService = testApp.moduleFixture.get(NetworkService);
    reviewService = testApp.moduleFixture.get(CloudCosignerReviewService);
    repository = testApp.moduleFixture.get(ICloudCosignerRepositoryToken);
    // Jobs left over from an aborted run must not be picked up here.
    const queue = testApp.moduleFixture.get<Queue>(
      getQueueToken(CLOUD_COSIGNER_QUEUE),
    );
    await queue.drain(true);
  });

  afterAll(async () => {
    await testApp?.destroy();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  function enrolledSafe(): Safe {
    return safeBuilder()
      .with('version', '1.3.0')
      .with('nonce', 4)
      .with('owners', [owner.address, cosignerAddress])
      .build();
  }

  async function proposal(safe: Safe): Promise<MultisigTransaction> {
    return multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .with('operation', Operation.CALL)
      .with('data', null)
      .with('value', '1000')
      .buildWithConfirmations({ chainId: chain.chainId, safe, signers: [] });
  }

  function mockUpstream(safe: Safe, transaction: MultisigTransaction): void {
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/safes/${safe.address}`:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        case `${chain.transactionService}/api/v2/multisig-transactions/${transaction.safeTxHash}/`:
          return Promise.resolve({
            data: rawify(multisigTransactionToJson(transaction)),
            status: 200,
          });
        default:
          // Balances and history are best-effort context; failing them routes
          // the transaction to the (mocked) model review.
          return Promise.reject(new Error(`Unexpected request: ${url}`));
      }
    });
    networkService.post.mockResolvedValue({ data: rawify({}), status: 201 });
  }

  async function reviewFor(
    transaction: MultisigTransaction,
  ): Promise<CloudCosignerReview> {
    return vi.waitFor(
      async () => {
        const review = await repository.getReview({
          chainId: chain.chainId,
          safeTxHash: transaction.safeTxHash,
        });
        if (!review || review.status === ReviewStatus.PENDING) {
          throw new Error('review not finished');
        }
        return review;
      },
      { timeout: REVIEW_TIMEOUT_MS, interval: 200 },
    );
  }

  it('signs an approved proposal and posts a confirmation the verifier accepts', async () => {
    const safe = enrolledSafe();
    const transaction = await proposal(safe);
    mockUpstream(safe, transaction);
    mockAnthropicApi.review.mockResolvedValue({
      kind: 'verdict',
      verdict: reviewVerdictBuilder().with('verdict', Verdict.APPROVE).build(),
      model: 'claude-opus-5',
    });

    await reviewService.enqueueEvent({
      type: 'PENDING_MULTISIG_TRANSACTION',
      chainId: chain.chainId,
      address: safe.address,
      safeTxHash: transaction.safeTxHash,
    });
    const review = await reviewFor(transaction);

    expect(review).toMatchObject({
      status: ReviewStatus.APPROVED,
      mode: ReviewMode.LLM,
      triggeredRules: [PolicyRule.UNKNOWN_VALUE],
      model: 'claude-opus-5',
    });
    const signature = review.signature as Hex;
    await expect(
      recoverAddress({ hash: transaction.safeTxHash, signature }),
    ).resolves.toBe(cosignerAddress);
    expect(networkService.post).toHaveBeenCalledWith({
      url: `${chain.transactionService}/api/v1/multisig-transactions/${transaction.safeTxHash}/confirmations/`,
      data: { signature },
    });
    expect(mockAnthropicApi.review).toHaveBeenCalledWith({
      system: expect.stringContaining('cloud cosigner'),
      prompt: expect.stringContaining(transaction.safeTxHash),
    });
  });

  it('withholds the signature when the model rejects', async () => {
    const safe = enrolledSafe();
    const transaction = await proposal(safe);
    mockUpstream(safe, transaction);
    mockAnthropicApi.review.mockResolvedValue({
      kind: 'verdict',
      verdict: reviewVerdictBuilder()
        .with('verdict', Verdict.REJECT)
        .with('risk_flags', ['unknown_recipient'])
        .build(),
      model: 'claude-opus-5',
    });

    await reviewService.enqueueEvent({
      type: 'PENDING_MULTISIG_TRANSACTION',
      chainId: chain.chainId,
      address: safe.address,
      safeTxHash: transaction.safeTxHash,
    });
    const review = await reviewFor(transaction);

    expect(review).toMatchObject({
      status: ReviewStatus.REJECTED,
      mode: ReviewMode.LLM,
      riskFlags: ['unknown_recipient'],
      signature: null,
    });
    expect(networkService.post).not.toHaveBeenCalled();
  });

  it('rejects without consulting the model when the reported hash is wrong', async () => {
    const safe = enrolledSafe();
    const transaction = await proposal(safe);
    const forged = { ...transaction, value: '2000' };
    mockUpstream(safe, forged);

    await reviewService.enqueueEvent({
      type: 'PENDING_MULTISIG_TRANSACTION',
      chainId: chain.chainId,
      address: safe.address,
      safeTxHash: transaction.safeTxHash,
    });
    const review = await reviewFor(transaction);

    expect(review).toMatchObject({
      status: ReviewStatus.REJECTED,
      riskFlags: ['hash_mismatch'],
      signature: null,
    });
    expect(mockAnthropicApi.review).not.toHaveBeenCalled();
    expect(networkService.post).not.toHaveBeenCalled();
  });
});
