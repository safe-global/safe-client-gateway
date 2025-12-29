import type { Address } from 'viem';

/**
 * Represents an extracted contract from a transaction.
 */
export interface ExtractedContract {
  /** The contract address */
  readonly address: Address;
  /** Whether the interaction is a delegate call. */
  readonly isDelegateCall: boolean;
  /** The fallback handler address if the transaction is setting one, undefined otherwise. */
  readonly fallbackHandler?: Address | undefined;
}
