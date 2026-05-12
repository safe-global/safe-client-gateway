// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { RelayClassification } from '@/modules/relay/domain/entities/relay-classification.entity';
import { InvalidTransferError } from '@/modules/relay/domain/errors/invalid-transfer.error';
import { CreateProxyRule } from '@/modules/relay/domain/validation/rules/create-proxy.rule';
import { CreateSignerRule } from '@/modules/relay/domain/validation/rules/create-signer.rule';
import { ExecTransactionRule } from '@/modules/relay/domain/validation/rules/exec-transaction.rule';
import { MultiSendRule } from '@/modules/relay/domain/validation/rules/multi-send.rule';
import { RecoveryRule } from '@/modules/relay/domain/validation/rules/recovery.rule';
import type {
  RelayClassifyArgs,
  RelayValidationRule,
} from '@/modules/relay/domain/validation/relay-rule.interface';

/**
 * Walks the registered rules in order until one classifies the calldata or
 * raises a domain error. Throws {@link InvalidTransferError} if no rule
 * matches — this mirrors the terminal fall-through in the legacy
 * `LimitAddressesMapper`.
 *
 * Rule order is significant: it matches the legacy mapper sequence
 * (recovery → execTransaction → multiSend → createProxy → createSigner). In
 * particular `createSigner` is terminal, so it's last.
 */
@Injectable()
export class RelayClassifier {
  private readonly rules: ReadonlyArray<RelayValidationRule>;

  constructor(
    recovery: RecoveryRule,
    execTransaction: ExecTransactionRule,
    multiSend: MultiSendRule,
    createProxy: CreateProxyRule,
    createSigner: CreateSignerRule,
  ) {
    this.rules = [
      recovery,
      execTransaction,
      multiSend,
      createProxy,
      createSigner,
    ];
  }

  async classify(args: RelayClassifyArgs): Promise<RelayClassification> {
    for (const rule of this.rules) {
      const result = await rule.classify(args);
      if (result) return result;
    }
    throw new InvalidTransferError();
  }
}
