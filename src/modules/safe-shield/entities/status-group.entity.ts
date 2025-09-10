import { getStringEnumKeys } from '@/domain/common/utils/enum';
import { z } from 'zod';

export enum RecipientStatusGroup {
  /** Recipient interaction history - previous interactions with the recipient */
  RECIPIENT_INTERACTION = 'RECIPIENT_INTERACTION',

  /** Cross-chain bridge analysis - compatibility and ownership checks */
  BRIDGE = 'BRIDGE',
}

export enum ContractStatusGroup {
  /** Contract verification status - whether contracts are verified */
  CONTRACT_VERIFICATION = 'CONTRACT_VERIFICATION',

  /** Contract interaction history - previous interactions with contracts */
  CONTRACT_INTERACTION = 'CONTRACT_INTERACTION',

  /** Delegatecall operation detection - potentially dangerous delegate calls */
  DELEGATECALL = 'DELEGATECALL',
}

/**
 * Status groups for categorizing different types of security analysis checks.
 */
export const StatusGroup = {
  ...RecipientStatusGroup,
  ...ContractStatusGroup,

  /** Transaction-level threat analysis - malicious patterns and risks */
  THREAT: 'THREAT',
};

export type StatusGroup = typeof StatusGroup;

/**
 * Zod schema for validating RecipientStatusGroup enum values.
 *
 * @example
 * ```typescript
 * const group = RecipientStatusGroupSchema.parse('RECIPIENT_INTERACTION');
 * ```
 */
export const RecipientStatusGroupSchema = z.enum(
  getStringEnumKeys(RecipientStatusGroup),
);

/**
 * Zod schema for validating ContractStatusGroup enum values.
 *
 * @example
 * ```typescript
 * const group = ContractStatusGroupSchema.parse('CONTRACT_VERIFICATION');
 * ```
 */
export const ContractStatusGroupSchema = z.enum(
  getStringEnumKeys(ContractStatusGroup),
);

/**
 * Zod schema for validating StatusGroup values.
 *
 * @example
 * ```typescript
 * const group = StatusGroupSchema.parse('CONTRACT_VERIFICATION');
 * ```
 */
export const StatusGroupSchema = z.enum(getStringEnumKeys(StatusGroup));
