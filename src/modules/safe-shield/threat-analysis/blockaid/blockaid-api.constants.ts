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
