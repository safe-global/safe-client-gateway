// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { RelayClassification } from '@/modules/relay/domain/entities/relay-classification.entity';
import { InvalidTransferError } from '@/modules/relay/domain/errors/invalid-transfer.error';
import { UnofficialSignerFactoryError } from '@/modules/relay/domain/errors/unofficial-signer-factory.error';
import { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';
import type {
  RelayClassifyArgs,
  RelayValidationRule,
} from '@/modules/relay/domain/validation/relay-rule.interface';

@Injectable()
export class CreateSignerRule implements RelayValidationRule {
  constructor(
    private readonly relayTransactionHelper: RelayTransactionHelper,
  ) {}

  // The createSigner branch is terminal: once the selector matches, every
  // outcome (unofficial factory, malformed args, success) is decided here.
  async classify(
    args: RelayClassifyArgs,
  ): Promise<RelayClassification | null> {
    if (!this.relayTransactionHelper.isCreateSigner(args.data)) return null;

    if (
      !this.relayTransactionHelper.isOfficialSignerFactoryDeployment({
        chainId: args.chainId,
        address: args.to,
      })
    ) {
      throw new UnofficialSignerFactoryError();
    }

    const limitAddress =
      this.relayTransactionHelper.getSignerFactoryLimitAddress(args.data);
    if (!limitAddress) {
      // selector matched but the args failed to decode (malformed payload).
      throw new InvalidTransferError();
    }

    return { kind: 'createSigner', limitAddress };
  }
}
