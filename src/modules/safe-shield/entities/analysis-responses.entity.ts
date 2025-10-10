import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type {
  ContractStatusGroup,
  RecipientStatusGroup,
} from './status-group.entity';
import {
  ContractStatusGroupSchema,
  RecipientStatusGroupSchema,
  ThreatStatusGroupSchema,
} from './status-group.entity';
import {
  RecipientAnalysisResultSchema,
  ContractAnalysisResultSchema,
  ThreatAnalysisResultSchema,
  type RecipientAnalysisResult,
  type ContractAnalysisResult,
} from './analysis-result.entity';
import { BalanceChangesSchema } from './threat-analysis.types';

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
 * Response structure for threat analysis endpoint.
 *
 * Returns threat analysis results grouped by category along with balance changes.
 * Unlike recipient/contract analysis, threat analysis operates at the
 * transaction level rather than per-address.
 */
export const ThreatAnalysisResponseSchema = z.record(
  ThreatStatusGroupSchema,
  z.union([z.array(ThreatAnalysisResultSchema), BalanceChangesSchema]),
);

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
