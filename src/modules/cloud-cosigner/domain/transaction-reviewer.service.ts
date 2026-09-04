// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { AnthropicApi } from '@/modules/cloud-cosigner/datasources/anthropic-api.service';
import type { ReviewInput } from '@/modules/cloud-cosigner/domain/entities/review-input.entity';
import type { ReviewOutcome } from '@/modules/cloud-cosigner/domain/entities/review-verdict.entity';
import { REVIEW_SYSTEM_PROMPT } from '@/modules/cloud-cosigner/domain/review-system-prompt';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

const MAX_DECODED_DATA_CHARS = 20_000;
const MAX_CALLDATA_CHARS = 4_000;
const JSON_INDENT = 1;

@Injectable()
export class TransactionReviewer {
  constructor(
    @Inject(AnthropicApi) private readonly anthropicApi: AnthropicApi,
  ) {}

  public review(input: ReviewInput): Promise<ReviewOutcome> {
    return this.anthropicApi.review({
      system: REVIEW_SYSTEM_PROMPT,
      prompt: TransactionReviewer.buildPrompt(input),
    });
  }

  public static buildPrompt(input: ReviewInput): string {
    return [
      ...describeSafe(input),
      '',
      ...describePolicy(input),
      '',
      '<owner_instructions>',
      input.policy.instructions ?? 'none',
      '</owner_instructions>',
      '',
      ...describeTransaction(input),
      '',
      '<decoded_data>',
      input.dataDecoded
        ? truncate(
            JSON.stringify(input.dataDecoded, null, JSON_INDENT),
            MAX_DECODED_DATA_CHARS,
          )
        : 'not decodable',
      '</decoded_data>',
      '',
      ...describeHistory(input),
      '',
      'Decide whether to cosign this transaction.',
    ].join('\n');
  }
}

function describeSafe(input: ReviewInput): Array<string> {
  return [
    '<safe>',
    `Chain: ${input.chainName ?? 'unknown'} (chain ID ${input.chainId})`,
    `Address: ${input.safe.address}`,
    `Version: ${input.safe.version ?? 'unknown'}`,
    `Owners (${input.safe.owners.length}): ${input.safe.owners.join(', ')}`,
    `Cosigner (you): ${input.cosignerAddress}`,
    `Threshold: ${input.safe.threshold}`,
    `Current nonce: ${input.safe.nonce}`,
    `Modules: ${input.safe.modules?.join(', ') || 'none'}`,
    `Guard: ${input.safe.guard}`,
    `Fallback handler: ${input.safe.fallbackHandler}`,
    `Contracts previously interacted with: ${input.knownContracts.join(', ') || 'none known'}`,
    '</safe>',
  ];
}

function describePolicy(input: ReviewInput): Array<string> {
  return [
    '<policy>',
    `Value threshold: ${input.policy.valueThresholdUsd} ${input.fiatCode}`,
    `Review first interactions with unknown contracts: ${input.policy.reviewUnknownContracts}`,
    'Triggered rules:',
    ...input.evaluation.reasons.map((reason) => `- ${reason}`),
    '</policy>',
  ];
}

function describeTransaction(input: ReviewInput): Array<string> {
  const tx = input.transaction;
  const confirmations = (tx.confirmations ?? []).map((c) => c.owner);
  const legs = input.valuation.legs.map((leg) => {
    const amount = leg.formattedAmount ?? leg.amount.toString();
    const symbol = leg.symbol ?? leg.tokenAddress ?? 'native';
    const fiat =
      leg.fiatValue === null
        ? 'unknown fiat value'
        : `about ${Math.round(leg.fiatValue)} ${input.fiatCode}`;
    const via = leg.method ? ` via ${leg.method}` : '';
    const to = leg.counterparty ? ` to ${leg.counterparty}` : '';
    return `- ${amount} ${symbol}${via}${to} (${fiat})`;
  });
  return [
    '<transaction>',
    `Safe transaction hash: ${tx.safeTxHash}`,
    `Nonce: ${tx.nonce}`,
    `To: ${tx.to}`,
    `Value (wei): ${tx.value}`,
    `Operation: ${tx.operation === Operation.DELEGATE ? 'DELEGATE_CALL' : 'CALL'}`,
    `MultiSend batch: ${input.valuation.isMultiSend}`,
    `Proposer: ${tx.proposer ?? 'unknown'}${tx.proposedByDelegate ? ` (delegate ${tx.proposedByDelegate})` : ''}`,
    `Origin: ${tx.origin ?? 'none'}`,
    `Confirmations so far: ${confirmations.join(', ') || 'none'}`,
    `Gas token: ${tx.gasToken ?? 'native'}, refund receiver: ${tx.refundReceiver ?? 'none'}`,
    `Calldata: ${tx.data ? truncate(tx.data, MAX_CALLDATA_CHARS) : 'none'}`,
    'Value moved or approved:',
    ...(legs.length > 0 ? legs : ['- none']),
    '</transaction>',
  ];
}

function describeHistory(input: ReviewInput): Array<string> {
  const entries = input.history.map(
    (h) =>
      `- ${h.executionDate?.toISOString() ?? 'unknown date'}: to ${h.to}, value ${h.value}, selector ${h.selector ?? 'none'}, operation ${h.operation}`,
  );
  return [
    '<history>',
    ...(entries.length > 0 ? entries : ['no executed transactions']),
    '</history>',
  ];
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}… [truncated]` : value;
}
