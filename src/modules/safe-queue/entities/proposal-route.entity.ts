// SPDX-License-Identifier: FSL-1.1-MIT

// Matches the Queue Service's ProposalRoute StrEnum. Declaration order fixes
// the Postgres enum sort order there, with UNKNOWN first since values can
// only be appended later — mirrored here for consistency, not because order
// matters on this side.
export enum ProposalRoute {
  Unknown = 'UNKNOWN',
  Owner = 'OWNER',
  Delegate = 'DELEGATE',
  NestedOwner = 'NESTED_OWNER',
}
