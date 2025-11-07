import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { Address } from 'viem';
import type {
  ContractStatusGroup,
  RecipientStatusGroup,
} from './status-group.entity';
import {
  ContractStatusGroupSchema,
  RecipientStatusGroupSchema,
  ThreatStatusGroupSchema,
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
import { BalanceChangesSchema } from './threat-analysis.types';

const recipientGroupValueSchema = z
  .array(RecipientAnalysisResultSchema)
  .optional();

/**
 * Dynamically builds the shape object for all recipient status groups.
 * This ensures that each valid RecipientStatusGroup enum value is mapped
 * to the same array schema, maintaining type safety while avoiding
 * manual repetition of each field.
 */
const groupsShape = RecipientStatusGroupSchema.options.reduce(
  (acc, key) => {
    acc[key] = recipientGroupValueSchema;
    return acc;
  },
  {} as Record<RecipientStatusGroup, typeof recipientGroupValueSchema>,
);

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
      ...groupsShape,
    })
    .strict(),
);

const contractGroupValueSchema = z
  .array(ContractAnalysisResultSchema)
  .optional();

/**
 * Dynamically builds the shape object for all contract status groups.
 * This ensures that each valid ContractStatusGroup enum value is mapped
 * to the same array schema, maintaining type safety while avoiding
 * manual repetition of each field.
 */
const contractGroupsShape = ContractStatusGroupSchema.options.reduce(
  (acc, key) => {
    acc[key] = contractGroupValueSchema;
    return acc;
  },
  {} as Record<ContractStatusGroup, typeof contractGroupValueSchema>,
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
  z
    .object({
      logoUrl: z.string().optional(),
      name: z.string().optional(),
      ...contractGroupsShape,
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
 * Dynamically builds the shape object for all threat status groups.
 * Maps THREAT to an array of threat results and BALANCE_CHANGE to balance changes schema.
 */
const threatGroupsShape = ThreatStatusGroupSchema.options.reduce(
  (acc, key) => {
    if (key === 'THREAT') {
      acc[key] = z.array(ThreatAnalysisResultSchema).optional();
    } else if (key === 'BALANCE_CHANGE') {
      acc[key] = BalanceChangesSchema.optional();
    }
    return acc;
  },
  {} as Record<string, z.ZodTypeAny>,
);

/**
 * Response structure for threat analysis endpoint.
 *
 * Returns threat analysis results grouped by category along with balance changes.
 * Unlike recipient/contract analysis, threat analysis operates at the
 * transaction level rather than per-address.
 */
export const ThreatAnalysisResponseSchema = z
  .object(threatGroupsShape)
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
