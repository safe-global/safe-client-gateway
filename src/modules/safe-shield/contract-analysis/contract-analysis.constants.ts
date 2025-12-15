import type { Severity } from '@/modules/safe-shield/entities/severity.entity';
import type { ContractStatus } from '@/modules/safe-shield/entities/contract-status.entity';
import type { CommonStatus } from '@/modules/safe-shield/entities/analysis-result.entity';
import {
  COMMON_SEVERITY_MAPPING,
  COMMON_DESCRIPTION_MAPPING,
} from '@/modules/safe-shield/entities/common-status.constants';
import type { Address } from 'viem';

/** Address of the official fallback handler used by CowSwap TWAP contracts */
export const TWAP_FALLBACK_HANDLER: Address =
  '0x2f55e8b20D0B9FEFA187AA7d00B6Cbe563605bF5';

/**
 * List of networks where the TWAP fallback handler is used.
 * https://github.com/cowprotocol/composable-cow/blob/main/networks.json
 */
const TWAP_FALLBACK_HANDLER_NETWORKS: Array<string> = [
  '1',
  '100',
  '137',
  '11155111',
  '8453',
  '42161',
  '43114',
  '232',
  '59144',
];

/**
 * Returns the TWAP fallback handler address for the given chain if it's deployed.
 * The TWAP fallback handler is used by CowSwap for programmatic orders on supported networks.
 *
 * @param {string} chainId - The chain ID
 * @returns {string | undefined} The TWAP fallback handler address if deployed on the chain, undefined otherwise
 */
export const tWAPFallbackHandlerAddress = (
  chainId: string,
): Address | undefined => {
  return TWAP_FALLBACK_HANDLER_NETWORKS.includes(chainId)
    ? TWAP_FALLBACK_HANDLER
    : undefined;
};

/**
 * Severity mapping for contract analysis results.
 * Maps each contract status to its corresponding severity level.
 */
export const SEVERITY_MAPPING: Record<
  ContractStatus | CommonStatus,
  keyof typeof Severity
> = {
  ...COMMON_SEVERITY_MAPPING,
  VERIFIED: 'OK',
  NOT_VERIFIED: 'INFO',
  NOT_VERIFIED_BY_SAFE: 'INFO',
  VERIFICATION_UNAVAILABLE: 'WARN',
  NEW_CONTRACT: 'INFO',
  KNOWN_CONTRACT: 'OK',
  UNEXPECTED_DELEGATECALL: 'WARN',
  UNOFFICIAL_FALLBACK_HANDLER: 'WARN',
};

/**
 * Title mapping for contract analysis results.
 * Maps each contract status to its user-facing title.
 */
export const TITLE_MAPPING: Record<ContractStatus | CommonStatus, string> = {
  VERIFIED: 'Verified contract',
  NOT_VERIFIED: 'Unverified contract',
  NOT_VERIFIED_BY_SAFE: 'New contract',
  VERIFICATION_UNAVAILABLE: 'Unable to verify contract',
  NEW_CONTRACT: 'First contract interaction',
  KNOWN_CONTRACT: 'Known contract',
  UNEXPECTED_DELEGATECALL: 'Unexpected delegateCall',
  FAILED: 'Contract analysis failed',
  UNOFFICIAL_FALLBACK_HANDLER: 'Unofficial fallback handler',
};

type DescriptionArgs = {
  name?: string;
  error?: string;
};

/**
 * Description mapping for contract analysis results.
 * Maps each contract status to a function that generates the description.
 */
export const DESCRIPTION_MAPPING: Record<
  ContractStatus | CommonStatus,
  (args?: DescriptionArgs) => string
> = {
  ...COMMON_DESCRIPTION_MAPPING,
  VERIFIED: ({ name } = {}) =>
    `This contract is verified${name ? ` as "${name}"` : ''}.`,
  NOT_VERIFIED: () => 'This contract is not verified yet.',
  NOT_VERIFIED_BY_SAFE: () =>
    'This contract has not been interacted with on Safe{Wallet}. If verified, it will be marked as such after the first transaction.',
  VERIFICATION_UNAVAILABLE: () =>
    'Contract verification is currently unavailable.',
  NEW_CONTRACT: () =>
    'You are interacting with this contract for the first time.',
  KNOWN_CONTRACT: () => 'You have already interacted with this contract.',
  UNEXPECTED_DELEGATECALL: () =>
    'This transaction calls a smart contract that will be able to modify your Safe account. Learn more',
  UNOFFICIAL_FALLBACK_HANDLER: () =>
    'Verify the fallback handler is trusted and secure before proceeding.',
};
