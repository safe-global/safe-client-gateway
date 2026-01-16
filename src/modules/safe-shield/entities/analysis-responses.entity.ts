import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { type Address } from 'viem';
import type {
  ContractStatusGroup,
  RecipientStatusGroup,
} from './status-group.entity';
import type { AnalysisResult, CommonStatus } from './analysis-result.entity';
import {
  RecipientAnalysisResultSchema,
  ContractAnalysisResultSchema,
  ThreatAnalysisResultSchema,
  type RecipientAnalysisResult,
  type ContractAnalysisResult,
  UnofficialFallbackHandlerAnalysisResultSchema,
} from './analysis-result.entity';
import type { RecipientStatus } from '@/modules/safe-shield/entities/recipient-status.entity';
import { BalanceChangesSchema } from './threat-analysis.types';

const recipientGroupValueSchema = z
  .array(RecipientAnalysisResultSchema)
  .optional();

/**
 * Response structure for recipient analysis endpoint.
 *
 * Maps recipient addresses to their analysis results grouped by status group.
 * Multiple addresses can be analyzed in a single request (e.g., multi-send transactions).
 * Results are sorted by severity within each group (CRITICAL first).
 */
export const RecipientAnalysisResponseSchema = z.record(
  AddressSchema,
  z
    .object({
      isSafe: z.boolean(),
      RECIPIENT_INTERACTION: recipientGroupValueSchema,
      RECIPIENT_ACTIVITY: recipientGroupValueSchema,
      BRIDGE: recipientGroupValueSchema,
    })
    .strict(),
);

const contractGroupValueSchema = z
  .array(ContractAnalysisResultSchema)
  .optional();

/**
 * Response structure for contract analysis endpoint.
 *
 * Maps contract addresses to their analysis results grouped by status group.
 * Similar to recipient analysis but focuses on contract-specific checks
 * like verification status and delegatecall detection.
 */
export const ContractAnalysisResponseSchema = z.record(
  AddressSchema,
  z
    .object({
      logoUrl: z.url().optional(),
      name: z.string().optional(),
      CONTRACT_VERIFICATION: contractGroupValueSchema,
      CONTRACT_INTERACTION: contractGroupValueSchema,
      DELEGATECALL: contractGroupValueSchema,
      FALLBACK_HANDLER: z
        .array(UnofficialFallbackHandlerAnalysisResultSchema)
        .optional(),
    })
    .strict(),
);

/**
 * Response structure for counterparty analysis endpoint.
 *
 * Combines recipient and contract analysis results for a single
 * transaction simulation.
 */
export const CounterpartyAnalysisResponseSchema = z.object({
  recipient: RecipientAnalysisResponseSchema,
  contract: ContractAnalysisResponseSchema,
});

/**
 * Response structure for threat analysis endpoint.
 *
 * Returns threat analysis results grouped by category along with balance changes.
 * Unlike recipient/contract analysis, threat analysis operates at the
 * transaction level rather than per-address.
 * Includes request_id from Blockaid's x-request-id header for reporting.
 */
export const ThreatAnalysisResponseSchema = z
  .object({
    THREAT: z.array(ThreatAnalysisResultSchema).optional(),
    BALANCE_CHANGE: BalanceChangesSchema.optional(),
    request_id: z.string().optional(),
  })
  .strict();

/**
 * TypeScript types derived from the Zod schemas.
 */
export type RecipientAnalysisResponse = z.infer<
  typeof RecipientAnalysisResponseSchema
>;

export type ContractAnalysisResponse = z.infer<
  typeof ContractAnalysisResponseSchema
>;
export type ThreatAnalysisResponse = z.infer<
  typeof ThreatAnalysisResponseSchema
>;
export type CounterpartyAnalysisResponse = z.infer<
  typeof CounterpartyAnalysisResponseSchema
>;

/**
 * RecipientAnalysisResponse without the isSafe field.
 * Used for responses where isSafe information is not available (e.g., bridge analysis).
 */
export type RecipientAnalysisResponseWithoutIsSafe = Record<
  Address,
  Omit<
    NonNullable<RecipientAnalysisResponse[keyof RecipientAnalysisResponse]>,
    'isSafe'
  >
>;

/**
 * Result of contract verification with optional metadata.
 * Includes analysis results grouped by status and contract metadata like name and logo.
 */
export type ContractVerificationResult =
  GroupedAnalysisResults<ContractAnalysisResult> & {
    name?: string;
    logoUrl?: string;
  };

/**
 * Helper type for analysis results grouped by status group.
 *
 * This represents the structure used for recipient and contract
 * analysis responses where results are organized by status group.
 * Note: Not applicable to threat analysis which has different value types per group.
 */
export type GroupedAnalysisResults<
  T extends RecipientAnalysisResult | ContractAnalysisResult,
> = {
  [group in T extends RecipientAnalysisResult
    ? RecipientStatusGroup
    : ContractStatusGroup]?: Array<T>;
};

/**
 * Response structure for single recipient analysis.
 *
 * Contains the RECIPIENT_INTERACTION status group (required) and
 * RECIPIENT_ACTIVITY status group (optional).
 * Used by the analyzeRecipient endpoint which focuses on recipient interaction history and activity patterns.
 */
export type SingleRecipientAnalysisResponse = Required<
  Pick<
    GroupedAnalysisResults<AnalysisResult<RecipientStatus | CommonStatus>>,
    'RECIPIENT_INTERACTION'
  >
> &
  Pick<
    GroupedAnalysisResults<AnalysisResult<RecipientStatus | CommonStatus>>,
    'RECIPIENT_ACTIVITY'
  > & {
    isSafe: boolean;
  };
