import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type {
  ContractStatusGroup,
  RecipientStatusGroup,
} from './status-group.entity';
import {
  ContractStatusGroupSchema,
  RecipientStatusGroupSchema,
} from './status-group.entity';
import type { AnalysisResult, CommonStatus } from './analysis-result.entity';
import {
  RecipientAnalysisResultSchema,
  ContractAnalysisResultSchema,
  ThreatAnalysisResultSchema,
  type RecipientAnalysisResult,
  type ContractAnalysisResult,
} from './analysis-result.entity';
import type { RecipientStatus } from '@/modules/safe-shield/entities/recipient-status.entity';

/**
 * Response structure for recipient analysis endpoint.
 *
 * Maps recipient addresses to their analysis results grouped by status group.
 * Multiple addresses can be analyzed in a single request (e.g., multi-send transactions).
 * Results are sorted by severity within each group (CRITICAL first).
 */
export const RecipientAnalysisResponseSchema = z.record(
  AddressSchema,
  z.record(
    RecipientStatusGroupSchema,
    z.array(RecipientAnalysisResultSchema).optional(),
  ),
);

/**
 * Response structure for contract analysis endpoint.
 *
 * Maps contract addresses to their analysis results grouped by status group.
 * Similar to recipient analysis but focuses on contract-specific checks
 * like verification status and delegatecall detection.
 */
export const ContractAnalysisResponseSchema = z.record(
  AddressSchema,
  z.record(
    ContractStatusGroupSchema,
    z.array(ContractAnalysisResultSchema).optional(),
  ),
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
 * Returns a single threat analysis result for the entire transaction.
 * Unlike recipient/contract analysis, threat analysis operates at the
 * transaction level rather than per-address.
 */
export const ThreatAnalysisResponseSchema = ThreatAnalysisResultSchema;

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
 * Helper type for analysis results grouped by status group.
 *
 * This represents the structure used for both recipient and contract
 * analysis responses where results are organized by status group.
 */
export type GroupedAnalysisResults<
  T extends RecipientAnalysisResult | ContractAnalysisResult,
> = {
  [group in T extends RecipientAnalysisResult
    ? RecipientStatusGroup
    : ContractStatusGroup]?: Array<T>;
};

/**
 * Response structure for single recipient interaction analysis.
 *
 * Contains only the RECIPIENT_INTERACTION status group.
 * Used by the analyzeRecipient endpoint which focuses on recipient interaction history.
 */
export type RecipientInteractionAnalysisResponse = Required<
  Pick<
    GroupedAnalysisResults<AnalysisResult<RecipientStatus | CommonStatus>>,
    'RECIPIENT_INTERACTION'
  >
>;
