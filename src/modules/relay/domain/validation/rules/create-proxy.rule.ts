// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { RelayClassification } from '@/modules/relay/domain/entities/relay-classification.entity';
import { UnofficialProxyFactoryError } from '@/modules/relay/domain/errors/unofficial-proxy-factory.error';
import { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';
import type {
  RelayClassifyArgs,
  RelayValidationRule,
} from '@/modules/relay/domain/validation/relay-rule.interface';

@Injectable()
export class CreateProxyRule implements RelayValidationRule {
  constructor(
    private readonly relayTransactionHelper: RelayTransactionHelper,
  ) {}

  async classify(
    args: RelayClassifyArgs,
  ): Promise<RelayClassification | null> {
    if (
      !this.relayTransactionHelper.isValidCreateProxyWithNonceCall({
        version: args.version,
        chainId: args.chainId,
        data: args.data,
      })
    ) {
      return null;
    }

    if (
      !this.relayTransactionHelper.isOfficialProxyFactoryDeployment({
        version: args.version,
        chainId: args.chainId,
        address: args.to,
      })
    ) {
      throw new UnofficialProxyFactoryError();
    }

    const owners =
      this.relayTransactionHelper.getOwnersFromCreateProxyWithNonce(args.data);
    return { kind: 'createProxy', owners };
  }
}
