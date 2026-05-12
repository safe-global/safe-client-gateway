// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { RelayClassification } from '@/modules/relay/domain/entities/relay-classification.entity';
import { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';
import type {
  RelayClassifyArgs,
  RelayValidationRule,
} from '@/modules/relay/domain/validation/relay-rule.interface';

@Injectable()
export class RecoveryRule implements RelayValidationRule {
  constructor(
    private readonly relayTransactionHelper: RelayTransactionHelper,
  ) {}

  async classify(
    args: RelayClassifyArgs,
  ): Promise<RelayClassification | null> {
    const safeAddress =
      await this.relayTransactionHelper.getSafeBeingRecovered(args);
    if (!safeAddress) return null;
    return { kind: 'recovery', safeAddress };
  }
}
