import { z } from 'zod';

/**
 * Status groups for categorizing different types of security analysis checks.
 */
export enum StatusGroup {
  /** Recipient interaction history - previous interactions with the recipient */
  RECIPIENT_INTERACTION = 'RECIPIENT_INTERACTION',

  /** Cross-chain bridge analysis - compatibility and ownership checks */
  BRIDGE = 'BRIDGE',

  /** Contract verification status - whether contracts are verified */
  CONTRACT_VERIFICATION = 'CONTRACT_VERIFICATION',

  /** Contract interaction history - previous interactions with contracts */
  CONTRACT_INTERACTION = 'CONTRACT_INTERACTION',

  /** Delegatecall operation detection - potentially dangerous delegate calls */
  DELEGATECALL = 'DELEGATECALL',

  /** Transaction-level threat analysis - malicious patterns and risks */
  THREAT = 'THREAT',
}

/**
 * Zod schema for validating StatusGroup enum values.
 *
 * @example
 * ```typescript
 * const group = StatusGroupSchema.parse('CONTRACT_VERIFICATION');
 * ```
 */
export const StatusGroupSchema = z.nativeEnum(StatusGroup);
