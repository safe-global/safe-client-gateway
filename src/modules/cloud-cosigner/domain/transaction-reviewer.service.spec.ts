// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import type { AnthropicApi } from '@/modules/cloud-cosigner/datasources/anthropic-api.service';
import { cloudCosignerPolicyBuilder } from '@/modules/cloud-cosigner/domain/entities/__tests__/cloud-cosigner-policy.builder';
import { reviewVerdictBuilder } from '@/modules/cloud-cosigner/domain/entities/__tests__/review-verdict.builder';
import { PolicyRule } from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-review.entity';
import type { ReviewInput } from '@/modules/cloud-cosigner/domain/entities/review-input.entity';
import type { ReviewOutcome } from '@/modules/cloud-cosigner/domain/entities/review-verdict.entity';
import { TransactionReviewer } from '@/modules/cloud-cosigner/domain/transaction-reviewer.service';
import { dataDecodedBuilder } from '@/modules/data-decoder/domain/v2/entities/__tests__/data-decoded.builder';
import { multisigTransactionBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

const mockAnthropicApi = {
  review: vi.fn(),
} as MockedObject<AnthropicApi>;

function reviewInput(overrides: Partial<ReviewInput> = {}): ReviewInput {
  const chain = chainBuilder().build();
  return {
    chainId: chain.chainId,
    chainName: chain.chainName,
    fiatCode: 'USD',
    safe: safeBuilder().build(),
    cosignerAddress: getAddress(faker.finance.ethereumAddress()),
    policy: cloudCosignerPolicyBuilder().build(),
    transaction: multisigTransactionBuilder().build(),
    dataDecoded: dataDecodedBuilder().build(),
    valuation: {
      legs: [],
      isMultiSend: false,
      knownFiatValue: 0,
      hasUnknownValue: false,
    },
    evaluation: {
      triggeredRules: [PolicyRule.VALUE_OVER_THRESHOLD],
      reasons: [
        'Moves about 200000 USD, above the 100000 USD policy threshold.',
      ],
    },
    knownContracts: [],
    history: [],
    ...overrides,
  };
}

describe('TransactionReviewer', () => {
  const reviewer = new TransactionReviewer(mockAnthropicApi);

  it('should pass the built prompt to the API and return its outcome', async () => {
    const outcome: ReviewOutcome = {
      kind: 'verdict',
      verdict: reviewVerdictBuilder().build(),
      model: 'claude-opus-5',
    };
    mockAnthropicApi.review.mockResolvedValue(outcome);
    const input = reviewInput();

    await expect(reviewer.review(input)).resolves.toBe(outcome);

    expect(mockAnthropicApi.review).toHaveBeenCalledWith({
      system: expect.stringContaining('cloud cosigner of a Safe'),
      prompt: TransactionReviewer.buildPrompt(input),
    });
  });

  describe('buildPrompt', () => {
    it('should include the Safe, policy, transaction and triggered rules', () => {
      const input = reviewInput({
        policy: cloudCosignerPolicyBuilder()
          .with('instructions', 'Only pay listed vendors.')
          .build(),
      });

      const prompt = TransactionReviewer.buildPrompt(input);

      expect(prompt).toContain(`Address: ${input.safe.address}`);
      expect(prompt).toContain(`Cosigner (you): ${input.cosignerAddress}`);
      expect(prompt).toContain(
        `Value threshold: ${input.policy.valueThresholdUsd} USD`,
      );
      expect(prompt).toContain('Only pay listed vendors.');
      expect(prompt).toContain(input.evaluation.reasons[0]);
      expect(prompt).toContain(
        `Safe transaction hash: ${input.transaction.safeTxHash}`,
      );
      expect(prompt).toContain(`To: ${input.transaction.to}`);
      expect(prompt).toContain(JSON.stringify(input.dataDecoded, null, 1));
    });

    it('should describe value legs with fiat when known and mark unknown ones', () => {
      const token = getAddress(faker.finance.ethereumAddress());
      const recipient = getAddress(faker.finance.ethereumAddress());
      const input = reviewInput({
        valuation: {
          isMultiSend: false,
          knownFiatValue: 1500,
          hasUnknownValue: true,
          legs: [
            {
              kind: 'erc20',
              tokenAddress: token,
              amount: 1500_000000n,
              method: 'transfer',
              counterparty: recipient,
              symbol: 'USDC',
              formattedAmount: '1500',
              fiatValue: 1500,
            },
            {
              kind: 'erc20',
              tokenAddress: token,
              amount: 5n,
              method: 'approve',
              counterparty: recipient,
              symbol: null,
              formattedAmount: null,
              fiatValue: null,
            },
          ],
        },
      });

      const prompt = TransactionReviewer.buildPrompt(input);

      expect(prompt).toContain(
        `- 1500 USDC via transfer to ${recipient} (about 1500 USD)`,
      );
      expect(prompt).toContain(
        `- 5 ${token} via approve to ${recipient} (unknown fiat value)`,
      );
    });

    it('should render history entries and fall back when there are none', () => {
      const to = getAddress(faker.finance.ethereumAddress());
      const executionDate = faker.date.recent();
      const withHistory = TransactionReviewer.buildPrompt(
        reviewInput({
          history: [
            {
              to,
              value: '0',
              selector: '0xa9059cbb',
              operation: Operation.CALL,
              executionDate,
            },
          ],
        }),
      );
      const withoutHistory = TransactionReviewer.buildPrompt(
        reviewInput({ history: [], dataDecoded: null }),
      );

      expect(withHistory).toContain(
        `- ${executionDate.toISOString()}: to ${to}, value 0, selector 0xa9059cbb, operation 0`,
      );
      expect(withoutHistory).toContain('no executed transactions');
      expect(withoutHistory).toContain('not decodable');
    });

    it('should truncate oversized calldata', () => {
      const data = `0x${'ab'.repeat(5_000)}` as const;
      const input = reviewInput({
        transaction: multisigTransactionBuilder().with('data', data).build(),
      });

      const prompt = TransactionReviewer.buildPrompt(input);

      expect(prompt).not.toContain(data);
      expect(prompt).toContain('[truncated]');
    });
  });
});
