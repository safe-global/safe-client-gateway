import { z } from 'zod';
import { getStringEnumKeys } from '@/domain/common/utils/enum';

/**
 * Status codes for recipient analysis in Safe Shield security checks.
 *
 * These statuses are returned when analyzing transaction recipients to determine
 * their trustworthiness and interaction history with the Safe.
 */
export enum RecipientStatus {
  /** This is the first time interacting with this recipient */
  NEW_RECIPIENT = 'NEW_RECIPIENT',

  /** This recipient has been interacted with before */
  KNOWN_RECIPIENT = 'KNOWN_RECIPIENT',
}

/**
 * Zod schema for validating RecipientStatus enum values.
 *
 * @example
 * ```typescript
 * const status = RecipientStatusSchema.parse('NEW_RECIPIENT');
 * ```
 */
export const RecipientStatusSchema = z.enum(getStringEnumKeys(RecipientStatus));
