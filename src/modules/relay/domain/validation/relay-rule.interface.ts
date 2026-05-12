// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { RelayClassification } from '@/modules/relay/domain/entities/relay-classification.entity';

export interface RelayClassifyArgs {
  version: string;
  chainId: string;
  to: Address;
  data: Hex;
}

/**
 * One step in the relay validation pipeline. A rule "owns" a calldata shape
 * (e.g. `multiSend`); when it owns the shape it either returns a populated
 * {@link RelayClassification} or throws a domain error if validation fails.
 * Returning `null` means the rule doesn't apply and the next rule should try.
 */
export interface RelayValidationRule {
  classify(args: RelayClassifyArgs): Promise<RelayClassification | null>;
}
