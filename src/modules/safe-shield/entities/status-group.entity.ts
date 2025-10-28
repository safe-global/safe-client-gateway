import { z } from 'zod';

export const RecipientStatusGroup = [
  /** Recipient interaction history - previous interactions with the recipient */
  'RECIPIENT_INTERACTION',

  /** Recipient activity analysis - activity frequency */
  'RECIPIENT_ACTIVITY',

  /** Cross-chain bridge analysis - compatibility and ownership checks */
  'BRIDGE',
] as const;

export const ContractStatusGroup = [
  /** Contract verification status - whether contracts are verified */
  'CONTRACT_VERIFICATION',

  /** Contract interaction history - previous interactions with contracts */
  'CONTRACT_INTERACTION',

  /** Delegatecall operation detection - potentially dangerous delegate calls */
  'DELEGATECALL',
] as const;

export const ThreatStatusGroup = [
  /** Transaction-level threat analysis - malicious patterns and risks */
  'THREAT',

  /** Balance changes detected in the transaction */
  'BALANCE_CHANGE',
] as const;

/**
 * Status groups for categorizing different types of security analysis checks.
 */
export const StatusGroup = [
  ...RecipientStatusGroup,
  ...ContractStatusGroup,
  ...ThreatStatusGroup,
] as const;

/**
 * Zod schema for validating RecipientStatusGroup enum values.
 *
 * @example
 * ```typescript
 * const group = RecipientStatusGroupSchema.parse('RECIPIENT_INTERACTION');
 * ```
 */
export const RecipientStatusGroupSchema = z.enum(RecipientStatusGroup);

/**
 * Zod schema for validating ContractStatusGroup enum values.
 *
 * @example
 * ```typescript
 * const group = ContractStatusGroupSchema.parse('CONTRACT_VERIFICATION');
 * ```
 */
export const ContractStatusGroupSchema = z.enum(ContractStatusGroup);

/**
 * Zod schema for validating ThreatStatusGroup enum values.
 *
 * @example
 * ```typescript
 * const group = ThreatStatusGroupSchema.parse('THREAT');
 * ```
 */
export const ThreatStatusGroupSchema = z.enum(ThreatStatusGroup);

/**
 * Zod schema for validating StatusGroup values.
 *
 * @example
 * ```typescript
 * const group = StatusGroupSchema.parse('CONTRACT_VERIFICATION');
 * ```
 */
export const StatusGroupSchema = z.enum(StatusGroup);

export type RecipientStatusGroup = z.infer<typeof RecipientStatusGroupSchema>;
export type ContractStatusGroup = z.infer<typeof ContractStatusGroupSchema>;
export type ThreatStatusGroup = z.infer<typeof ThreatStatusGroupSchema>;
export type StatusGroup = z.infer<typeof StatusGroupSchema>;
