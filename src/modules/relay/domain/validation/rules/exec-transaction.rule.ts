// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { RelayClassification } from '@/modules/relay/domain/entities/relay-classification.entity';
import { UnofficialMasterCopyError } from '@/modules/relay/domain/errors/unofficial-master-copy.error';
import { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';
import type {
  RelayClassifyArgs,
  RelayValidationRule,
} from '@/modules/relay/domain/validation/relay-rule.interface';

@Injectable()
export class ExecTransactionRule implements RelayValidationRule {
  constructor(
    private readonly relayTransactionHelper: RelayTransactionHelper,
  ) {}

  async classify(
    args: RelayClassifyArgs,
  ): Promise<RelayClassification | null> {
    const decoded = this.relayTransactionHelper.decodeExecTransaction(
      args.data,
    );
    if (!decoded) return null;
    if (
      !this.relayTransactionHelper.isValidDecodedExecTransaction({
        to: args.to,
        decoded,
      })
    ) {
      // decoded as execTransaction but payload failed validity rules; let the
      // pipeline fall through to its terminal InvalidTransferError.
      return null;
    }

    const isOfficial = await this.relayTransactionHelper.isOfficialMastercopy({
      chainId: args.chainId,
      address: args.to,
    });
    if (!isOfficial) {
      throw new UnofficialMasterCopyError();
    }

    return { kind: 'execTransaction', safeAddress: args.to, decoded };
  }
}
