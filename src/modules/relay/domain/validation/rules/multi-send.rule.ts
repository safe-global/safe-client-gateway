// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { RelayClassification } from '@/modules/relay/domain/entities/relay-classification.entity';
import { UnofficialMasterCopyError } from '@/modules/relay/domain/errors/unofficial-master-copy.error';
import { UnofficialMultiSendError } from '@/modules/relay/domain/errors/unofficial-multisend.error';
import { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';
import type {
  RelayClassifyArgs,
  RelayValidationRule,
} from '@/modules/relay/domain/validation/relay-rule.interface';

@Injectable()
export class MultiSendRule implements RelayValidationRule {
  constructor(
    private readonly relayTransactionHelper: RelayTransactionHelper,
  ) {}

  async classify(
    args: RelayClassifyArgs,
  ): Promise<RelayClassification | null> {
    if (!this.relayTransactionHelper.isMultiSend(args.data)) return null;

    if (
      !this.relayTransactionHelper.isOfficialMultiSendDeployment({
        version: args.version,
        chainId: args.chainId,
        address: args.to,
      })
    ) {
      throw new UnofficialMultiSendError();
    }

    // Throws InvalidMultiSendError if any inner tx is invalid or recipients
    // vary across the batch.
    const safeAddress = this.relayTransactionHelper.getSafeAddressFromMultiSend(
      args.data,
    );

    const isOfficial = await this.relayTransactionHelper.isOfficialMastercopy({
      chainId: args.chainId,
      address: safeAddress,
    });
    if (!isOfficial) {
      throw new UnofficialMasterCopyError();
    }

    return { kind: 'multiSend', safeAddress };
  }
}
