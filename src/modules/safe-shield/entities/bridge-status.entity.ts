import { z } from 'zod';
import { getStringEnumKeys } from '@/domain/common/utils/enum';

/**
 * Status codes for bridge analysis in Safe Shield security checks.
 *
 * These statuses are returned when analyzing cross-chain bridge operations
 * to identify potential compatibility issues, ownership problems, or
 * unsupported network configurations.
 */
export enum BridgeStatus {
  /** Target Safe version is incompatible with source Safe */
  INCOMPATIBLE_SAFE = 'INCOMPATIBLE_SAFE',

  /** No ownership on the target chain */
  MISSING_OWNERSHIP = 'MISSING_OWNERSHIP',

  /** Target network is not supported on Safe */
  UNSUPPORTED_NETWORK = 'UNSUPPORTED_NETWORK',

  /** Different Safe setup on target chain */
  DIFFERENT_SAFE_SETUP = 'DIFFERENT_SAFE_SETUP',
}

/**
 * Zod schema for validating BridgeStatus enum values.
 *
 * @example
 * ```typescript
 * const status = BridgeStatusSchema.parse('INCOMPATIBLE_SAFE');
 * ```
 */
export const BridgeStatusSchema = z.enum(getStringEnumKeys(BridgeStatus));
