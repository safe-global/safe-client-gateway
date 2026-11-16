// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';

/**
 * Placeholder EOA used as `from` when simulating a relayed transaction.
 * On-chain the caller is the relay provider's dispatcher; using a non-Safe
 * sentinel keeps `msg.sender`/`tx.origin` distinct from the Safe so
 * refund-receiver-zero flows debit the Safe to a third party (as they would in
 * production).
 */
export const SIMULATION_SENDER_SENTINEL: Address =
  '0x000000000000000000000000000000000000dEaD';
