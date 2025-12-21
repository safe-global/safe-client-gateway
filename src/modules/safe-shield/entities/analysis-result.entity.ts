import { z } from 'zod';
import { SeveritySchema, type Severity } from './severity.entity';
import {
  RecipientStatusSchema,
  type RecipientStatus,
} from './recipient-status.entity';
import { BridgeStatusSchema, type BridgeStatus } from './bridge-status.entity';
import {
  ContractStatusSchema,
  type ContractStatus,
} from './contract-status.entity';
import { ThreatStatusSchema, type ThreatStatus } from './threat-status.entity';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

/**
 * Common status code available for all analysis types.
 *
 * This status can be used as fallbacks across any analysis type
 * when errors or exceptional conditions occur.
 */
export const CommonStatus = [
  /** Analysis failed due to service issues or errors */
  'FAILED',
] as const;

/**
 * Zod schema for validating CommonStatus enum values.
 */
export const CommonStatusSchema = z.enum(CommonStatus);

export type CommonStatus = z.infer<typeof CommonStatusSchema>;

/**
 * Generic analysis result structure for Safe Shield security checks.
 *
 * Each analysis check produces a structured result with severity classification,
 * status type, user-facing messaging, and detailed description. This provides
 * a consistent format across all analysis types (recipient, contract, threat).
 *
 * @template T - The specific status type (AnalysisStatus)
 */
export interface AnalysisResult<T extends AnalysisStatus = AnalysisStatus> {
  /** Severity level indicating the importance and risk of this finding */
  severity: keyof typeof Severity;

  /** Specific status code identifying the type of finding */
  type: T;

  /** User-facing title/summary of the finding */
  title: string;

  /** Detailed description explaining the finding and its implications */
  description: string;
}

/**
 * Union type of all possible status types that can be used in analysis results.
 */
export type AnalysisStatus =
  | CommonStatus
  | RecipientStatus
  | BridgeStatus
  | ContractStatus
  | ThreatStatus;

/**
 * Zod schema for validating any status enum value.
 */
export const AnalysisStatusSchema = z.union([
  CommonStatusSchema,
  RecipientStatusSchema,
  BridgeStatusSchema,
  ContractStatusSchema,
  ThreatStatusSchema,
]);

/**
 * Base Zod schema for analysis results with generic status validation.
 *
 * This provides the common structure while allowing specific implementations
 * to constrain the status type as needed.
 */
export const AnalysisResultBaseSchema = z.object({
  severity: SeveritySchema,
  type: AnalysisStatusSchema,
  title: z.string().min(1, 'Title cannot be empty'),
  description: z.string().min(1, 'Description cannot be empty'),
});

/**
 * Zod schema for recipient analysis results.
 *
 * Combines recipient interaction and bridge analysis results using a union.
 * - BridgeStatus and CommonStatus results include optional targetChainId field
 * - RecipientStatus results do not include targetChainId field
 */
export const RecipientAnalysisResultSchema = z.union([
  AnalysisResultBaseSchema.extend({
    type: z.union([BridgeStatusSchema, CommonStatusSchema]),
    targetChainId: NumericStringSchema.optional(),
  }),
  AnalysisResultBaseSchema.extend({
    type: RecipientStatusSchema,
  }),
]);

/**
 * Zod schema for contract analysis results.
 */
export const ContractAnalysisResultSchema = AnalysisResultBaseSchema.extend({
  type: z.union([ContractStatusSchema, CommonStatusSchema]),
});

/** Zod schema definition for threat (MALICIOUS or MODERATE) analysis issues */
const ThreatIssueSchema = z.object({
  address: AddressSchema.optional(),
  description: z.string(),
});

/**
 * Zod schema for threat analysis results.
 * Split into multiple schemas to keep each variant focused and reusable.
 */
export const MasterCopyChangeThreatAnalysisResultSchema =
  AnalysisResultBaseSchema.extend({
    type: z.literal('MASTERCOPY_CHANGE'),
    before: AddressSchema,
    after: AddressSchema,
  });

export const MaliciousOrModerateThreatAnalysisResultSchema =
  AnalysisResultBaseSchema.extend({
    type: z.union([z.literal('MALICIOUS'), z.literal('MODERATE')]),
    issues: z.record(SeveritySchema, z.array(ThreatIssueSchema)).optional(),
  });

export const DefaultThreatAnalysisResultSchema =
  AnalysisResultBaseSchema.extend({
    type: z.union([
      ThreatStatusSchema.exclude([
        'MASTERCOPY_CHANGE',
        'MALICIOUS',
        'MODERATE',
      ]),
      CommonStatusSchema,
    ]),
  });

export const ThreatAnalysisResultSchema = z.union([
  MasterCopyChangeThreatAnalysisResultSchema,
  MaliciousOrModerateThreatAnalysisResultSchema,
  DefaultThreatAnalysisResultSchema,
]);

/**
 * Type definition for recipient analysis results.
 * Inferred from the Zod schema to avoid duplication.
 */
export type RecipientAnalysisResult = z.infer<
  typeof RecipientAnalysisResultSchema
>;

/**
 * Type definition for contract analysis results.
 * Inferred from the Zod schema to avoid duplication.
 */
export type ContractAnalysisResult = z.infer<
  typeof ContractAnalysisResultSchema
>;

//----------------------- Threat Analysis Result Types -------------------------//

export type MasterCopyChangeThreatAnalysisResult = z.infer<
  typeof MasterCopyChangeThreatAnalysisResultSchema
>;

export type ThreatIssue = z.infer<typeof ThreatIssueSchema>;
export type ThreatIssues = Partial<
  Record<keyof typeof Severity, Array<ThreatIssue>>
>;

export type MaliciousOrModerateThreatAnalysisResult = z.infer<
  typeof MaliciousOrModerateThreatAnalysisResultSchema
>;

/**
 * Type definition for threat analysis results.
 */
export type ThreatAnalysisResult = z.infer<typeof ThreatAnalysisResultSchema>;
