import type { Severity } from '@/modules/safe-shield/entities/severity.entity';

export const GUARD_STORAGE_POSITION =
  '0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8';
export const FF_RISK_MITIGATION = 'RISK_MITIGATION';
export const BLOCKAID_REQUEST_ID_HEADER = 'x-request-id';

export const BLOCKAID_SEVERITY_MAP: Record<string, keyof typeof Severity> = {
  Malicious: 'CRITICAL',
  Warning: 'WARN',
  Benign: 'OK',
  Info: 'INFO',
};

const REASON_MAPPING: Record<string, string> = {
  raw_ether_transfer: 'transfers native currency',
  signature_farming: 'is a raw signed transaction',
  transfer_farming: 'transfers tokens',
  approval_farming: 'approves erc20 tokens',
  set_approval_for_all: 'approves all tokens of the account',
  permit_farming: 'authorizes access or permissions',
  seaport_farming: 'authorizes transfer of assets via Opeansea marketplace',
  blur_farming: 'authorizes transfer of assets via Blur marketplace',
  delegatecall_execution: 'involves a delegate call',
};
const CLASSIFICATION_MAPPING: Record<string, string> = {
  known_malicious: 'to a known malicious address',
  unverified_contract: 'to an unverified contract',
  new_address: 'to a new address',
  untrusted_address: 'to an untrusted address',
  address_poisoning: 'to a poisoned address',
  losing_mint:
    'resulting in a mint for a new token with a significantly higher price than the known price',
  losing_assets: 'resulting in a loss of assets without any compensation',
  losing_trade: 'resulting in a losing trade',
  drainer_contract: 'to a known drainer contract',
  user_mistake: 'resulting in a loss of assets due to an innocent mistake',
  gas_farming_attack:
    'resulting in a waste of the account address’ gas to generate tokens for a scammer',
  other: 'resulting in a malicious outcome',
};

const ERROR_MAPPING: Record<string, string> = {
  GS000: 'Unable to set up your Safe. Please refresh and try again.',
  GS001: 'Please specify how many signatures are required for transactions.',
  GS002:
    'This account is not a contract. Modules can only be enabled on contract addresses.',
  GS010:
    'Insufficient funds to cover transaction fees. Please add funds or reduce gas.',
  GS011:
    'Unable to pay transaction fees with ETH. Please ensure you have enough ETH in your Safe.',
  GS012:
    'Unable to pay transaction fees with the selected token. Please use ETH or check token balance.',
  GS013:
    'Transaction failed due to incorrect gas settings.',
  GS020: 'Invalid signature format. Please try signing again.',
  GS021:
    'Signature validation failed. Please contact support with error code GS021.',
  GS022:
    'Signature validation failed. Please contact support with error code GS022.',
  GS023: 'Incomplete signature data. Please try signing again.',
  GS024:
    'The signature is invalid. Please check your wallet connection and try again.',
  GS025: 'This action requires approval from Safe signers first.',
  GS026:
    'This address is not a signer of this Safe. Please use a valid signer address.',
  GS030:
    'Only Safe signers can approve this action. Please connect with a signer wallet.',
  GS031: 'This action must be initiated from within the Safe.',
  GS100: 'Safe modules are already set up and cannot be initialized again.',
  GS101:
    'The module address is invalid. Please verify the address and try again.',
  GS102: 'This module is already installed on your Safe.',
  GS103: 'Unable to update Safe modules. Please refresh and try again.',
  GS104: 'This action can only be performed by an enabled Safe module.',
  GS105:
    'Invalid starting point for fetching paginated modules. Please refresh and try again.',
  GS106: 'Invalid page size for fetching paginated modules.',
  GS200: 'Safe signers are already configured and cannot be set up again.',
  GS201:
    'Required signatures cannot be more than the number of signers. Please adjust the threshold.',
  GS202: 'At least one signature is required for transactions.',
  GS203:
    'The signer address is invalid. Please enter a valid Ethereum address.',
  GS204: 'This address is already a signer of this Safe.',
  GS205: 'Unable to update signers. Please refresh the page and try again.',
  GS300:
    'The guard contract is incompatible with this Safe. Please use a compatible guard.',
  GS301:
    'The module guard is incompatible. Please replace it with a supported version.',
  GS400: 'Fallback handler cannot be the Safe itself. Use a different address.',
};

/**
 * Prepares a description from a scan description or falls back to reason and classification mapping.
 * @param {string} reason - A description about the reasons the transaction was flagged
 * @param {string} classification - A classification explaining the reason of threat analysis result
 * @param {string} description - A fallback description from Blockaid
 * @returns {string | undefined} The prepared description, if available
 */
export const prepareDescription = (
  reason?: string,
  classification?: string,
  description?: string,
): string | undefined => {
  if (description) {
    return `${description}.`;
  }

  const reasonMsg = reason && REASON_MAPPING[reason];
  const classificationMsg =
    classification && CLASSIFICATION_MAPPING[classification];

  if (!reasonMsg || !classificationMsg) {
    return undefined;
  }

  return `The transaction ${reasonMsg} ${classificationMsg}.`;
};

/**
 * Extracts error code from error string and maps it to a user-friendly message.
 * Error codes follow the pattern GS followed by 3 digits (e.g., GS030, GS123, GS301).
 * @param {string} error - The error string that may contain an error code
 * @returns {string | undefined} The mapped error message if an error code is found and mapped, the original error string if no error code is found or code is not in mapping, or undefined if error is undefined or empty
 */
export const prepareErrorMessage = (error?: string): string | undefined => {
  if (!error) return undefined;

  const match = error.match(/GS\d{3}/);
  if (!match) return error;

  return ERROR_MAPPING[match[0]] ?? error;
};
