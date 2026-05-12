// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import type { RelayClassification } from '@/modules/relay/domain/entities/relay-classification.entity';
import { RelayClassifier } from '@/modules/relay/domain/validation/relay-classifier';

/**
 * Backwards-compatible adapter over {@link RelayClassifier}. Existing relayers
 * (daily-limit, no-fee-campaign) need the addresses to rate-limit against;
 * this preserves that API while routing validation through the shared
 * pipeline so all relayers throw identical domain errors for the same input.
 */
@Injectable()
export class LimitAddressesMapper {
  constructor(private readonly classifier: RelayClassifier) {}

  async getLimitAddresses(args: {
    version: string;
    chainId: string;
    to: Address;
    data: Hex;
  }): Promise<ReadonlyArray<Address>> {
    const classification = await this.classifier.classify(args);
    return this.toRateLimitAddresses(classification);
  }

  // Maps a classification to the addresses to count this transaction against.
  // Mirrors the per-branch return values of the legacy ladder.
  private toRateLimitAddresses(
    classification: RelayClassification,
  ): ReadonlyArray<Address> {
    switch (classification.kind) {
      case 'recovery':
      case 'execTransaction':
      case 'multiSend':
        return [classification.safeAddress];
      case 'createProxy':
        return classification.owners;
      case 'createSigner':
        return [classification.limitAddress];
    }
  }
}
