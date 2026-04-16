// SPDX-License-Identifier: FSL-1.1-MIT

/** Result of a relay eligibility check. */
export interface RelayEligibility {
  /** Whether the relay is allowed. */
  result: boolean;
  /** Number of relays already consumed. */
  currentCount: number;
  /** Maximum number of relays allowed. */
  limit: number;
}
