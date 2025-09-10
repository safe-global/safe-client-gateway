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
  severity: Severity;

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
  | RecipientStatus
  | BridgeStatus
  | ContractStatus
  | ThreatStatus;

/**
 * Zod schema for validating any status enum value.
 */
export const AnalysisStatusSchema = z.union([
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
 */
export const RecipientAnalysisResultSchema = AnalysisResultBaseSchema.extend({
  type: z.union([RecipientStatusSchema, BridgeStatusSchema]),
});

/**
 * Zod schema for contract analysis results.
 */
export const ContractAnalysisResultSchema = AnalysisResultBaseSchema.extend({
  type: ContractStatusSchema,
});

/**
 * Zod schema for threat analysis results.
 */
export const ThreatAnalysisResultSchema = AnalysisResultBaseSchema.extend({
  type: ThreatStatusSchema,
});

/**
 * Type definition for recipient analysis results.
 */
export type RecipientAnalysisResult = AnalysisResult<
  RecipientStatus | BridgeStatus
>;

/**
 * Type definition for contract analysis results.
 */
export type ContractAnalysisResult = AnalysisResult<ContractStatus>;

/**
 * Type definition for threat analysis results.
 */
export type ThreatAnalysisResult = AnalysisResult<ThreatStatus>;
