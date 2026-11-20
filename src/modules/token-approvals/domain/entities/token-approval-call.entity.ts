// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hex } from 'viem';
import type { Operation } from '#/modules/safe/domain/entities/operation.entity';
import type { TokenSpender } from '#/modules/token-approvals/domain/entities/token-approval.entity';

/** A call a Safe made: a transaction of its own, or one action of a MultiSend batch. */
export type SafeCall = {
  to: Address;
  data: Hex | null;
  operation: Operation;
};

/** The fields the scan reads from an executed multisig or module transaction. */
export type ExecutedSafeCall = SafeCall & {
  isSuccessful: boolean | null;
  transactionHash: Hex | null;
};

export type SafeCallApprovals = {
  /** The token and spender pairs the call's calldata approves. */
  tokenSpenders: Array<TokenSpender>;
  /**
   * True when the call, or an action batched in it, is a delegatecall to
   * something other than MultiSend. Its approvals are not in the calldata, so
   * they can only be read from the events the transaction emitted.
   */
  hasOpaqueDelegateCall: boolean;
};

/** One history list of a Safe, read up to the configured page limit. */
export type SafeCallHistory = {
  calls: Array<ExecutedSafeCall>;
  /** False when the list has more pages than the scan is allowed to read. */
  isComplete: boolean;
};
