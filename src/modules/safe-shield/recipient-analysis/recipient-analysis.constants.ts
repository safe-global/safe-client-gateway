import type { RecipientStatus } from '@/modules/safe-shield/entities/recipient-status.entity';
import type { Severity } from '@/modules/safe-shield/entities/severity.entity';
import type { BridgeStatus } from '@/modules/safe-shield/entities/bridge-status.entity';

/**
 * Severity mapping for recipient analysis results.
 * Maps each recipient or bridge status to its corresponding severity level.
 */
export const SEVERITY_MAPPING: Record<
  RecipientStatus | BridgeStatus,
  keyof typeof Severity
> = {
  NEW_RECIPIENT: 'INFO',
  KNOWN_RECIPIENT: 'OK',
  INCOMPATIBLE_SAFE: 'CRITICAL',
  MISSING_OWNERSHIP: 'WARN',
  UNSUPPORTED_NETWORK: 'WARN',
  DIFFERENT_SAFE_SETUP: 'INFO',
};

/**
 * Title mapping for recipient analysis results.
 * Maps each recipient or bridge status to its user-facing title.
 */
export const TITLE_MAPPING: Record<RecipientStatus | BridgeStatus, string> = {
  NEW_RECIPIENT: 'New recipient',
  KNOWN_RECIPIENT: 'Recurring recipient',
  INCOMPATIBLE_SAFE: 'Incompatible Safe version',
  MISSING_OWNERSHIP: 'Missing ownership',
  UNSUPPORTED_NETWORK: 'Unsupported network',
  DIFFERENT_SAFE_SETUP: 'Different setup',
};

/**
 * Description mapping for recipient analysis results.
 * Maps each recipient or bridge status to a function that generates the description.
 */
export const DESCRIPTION_MAPPING: Record<
  RecipientStatus,
  (interactions: number) => string
> &
  Record<BridgeStatus, () => string> = {
  NEW_RECIPIENT: () =>
    'You are interacting with this address for the first time.',
  KNOWN_RECIPIENT: (interactions: number) =>
    `You have interacted with this address ${interactions} time${interactions > 1 ? 's' : ''}.`,
  INCOMPATIBLE_SAFE: () =>
    'This Safe account cannot be created on the destination chain. You will not be able to claim ownership of the same address. Funds sent may be inaccessible.',
  MISSING_OWNERSHIP: () =>
    'This Safe account is not activated on the target chain. First, create the Safe, execute a test transaction, and then proceed with bridging. Funds sent may be inaccessible.',
  UNSUPPORTED_NETWORK: () =>
    'app.safe.global does not support the network. Unless you have a wallet deployed there, we recommend not to bridge. Funds sent may be inaccessible.',
  DIFFERENT_SAFE_SETUP: () =>
    'Your Safe exists on the target chain but with a different configuration. Review carefully before proceeding. Funds sent may be inaccessible if the setup is incorrect.',
};
