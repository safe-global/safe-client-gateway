import { z } from 'zod';

/**
 * Status codes for contract analysis in Safe Shield security checks.
 *
 * These statuses are returned when analyzing smart contracts to determine
 * their verification status, interaction history, and potential security risks
 * such as unexpected delegatecall operations.
 *
 * Contract statuses span multiple status groups:
 * - CONTRACT_VERIFICATION
 * - CONTRACT_INTERACTION
 * - DELEGATECALL
 * - FALLBACK_HANDLER
 */
export const ContractStatus = [
  /** Contract is verified and source code is available */
  'VERIFIED',

  /** Contract is not verified */
  'NOT_VERIFIED',

  /** Contract is not verified yet on Safe but might be verified on other sources */
  'NOT_VERIFIED_BY_SAFE',

  /** Contract verification service is unavailable */
  'VERIFICATION_UNAVAILABLE',

  /** This is the first time interacting with this contract */
  'NEW_CONTRACT',

  /** This contract has been interacted with before */
  'KNOWN_CONTRACT',

  /** Unexpected or potentially dangerous delegatecall detected */
  'UNEXPECTED_DELEGATECALL',

  /** Unofficial fallback handler is detected */
  'UNOFFICIAL_FALLBACK_HANDLER',
] as const;

/**
 * Zod schema for validating ContractStatus enum values.
 *
 * @example
 * ```typescript
 * const status = ContractStatusSchema.parse('VERIFIED');
 * ```
 */
export const ContractStatusSchema = z.enum(ContractStatus);

export type ContractStatus = z.infer<typeof ContractStatusSchema>;
