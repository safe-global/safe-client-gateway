import type { Severity } from '@/modules/safe-shield/entities/severity.entity';
import type { ContractStatus } from '@/modules/safe-shield/entities/contract-status.entity';

/**
 * Severity mapping for contract analysis results.
 * Maps each contract status to its corresponding severity level.
 */
export const SEVERITY_MAPPING: Record<ContractStatus, keyof typeof Severity> = {
  VERIFIED: 'OK',
  NOT_VERIFIED: 'INFO',
  NOT_VERIFIED_BY_SAFE: 'INFO',
  VERIFICATION_UNAVAILABLE: 'WARN',
  NEW_CONTRACT: 'INFO',
  KNOWN_CONTRACT: 'OK',
  UNEXPECTED_DELEGATECALL: 'WARN',
};

/**
 * Title mapping for contract analysis results.
 * Maps each contract status to its user-facing title.
 */
export const TITLE_MAPPING: Record<ContractStatus, string> = {
  VERIFIED: 'Verified contract',
  NOT_VERIFIED: 'Unverified contract',
  NOT_VERIFIED_BY_SAFE: 'New contract',
  VERIFICATION_UNAVAILABLE: 'Unable to verify contract',
  NEW_CONTRACT: 'First contract interaction',
  KNOWN_CONTRACT: 'Known contract',
  UNEXPECTED_DELEGATECALL: 'Unexpected delegateCall',
};

type DescriptionArgs = {
  name?: string;
  interactions?: number;
};

/**
 * Description mapping for contract analysis results.
 * Maps each contract status to a function that generates the description.
 */
export const DESCRIPTION_MAPPING: Record<
  ContractStatus,
  (args?: DescriptionArgs) => string
> = {
  VERIFIED: ({ name } = {}) =>
    `This contract is verified${name ? ` as "${name}"` : ''}.`,
  NOT_VERIFIED: () => 'This contract is not verified yet.',
  NOT_VERIFIED_BY_SAFE: () =>
    'This contract has not been interacted with on Safe{Wallet}. If verified, it will be marked as such after the first transaction.',
  VERIFICATION_UNAVAILABLE: () =>
    'Contract verification is currently unavailable.',
  NEW_CONTRACT: () =>
    'You are interacting with this contract for the first time.',
  KNOWN_CONTRACT: ({ interactions = 0 } = {}) =>
    `You have interacted with this contract ${interactions} time${interactions !== 1 ? 's' : ''}.`,
  UNEXPECTED_DELEGATECALL: () => 'Unexpected delegateCall.',
};
