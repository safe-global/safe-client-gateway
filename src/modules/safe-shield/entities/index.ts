/**
 * Safe Shield analysis system - Entity exports
 *
 * This module provides the foundational types, enums, and Zod schemas for the
 * Safe Shield security analysis system. These entities define the structure
 * for analyzing transaction security across recipients, contracts, and threats.
 *
 * @module SafeShieldEntities
 */

// Core enums and types
export {
  Severity,
  SeveritySchema,
  SeverityOrder,
  getSeverityOrder,
  compareSeverity,
} from './severity.entity';

export {
  StatusGroup,
  StatusGroupSchema,
  RecipientStatusGroup,
  RecipientStatusGroupSchema,
  ContractStatusGroup,
  ContractStatusGroupSchema,
} from './status-group.entity';

// Status enums for different analysis types
export {
  RecipientStatus,
  RecipientStatusSchema,
} from './recipient-status.entity';
export { BridgeStatus, BridgeStatusSchema } from './bridge-status.entity';
export { ContractStatus, ContractStatusSchema } from './contract-status.entity';
export { ThreatStatus, ThreatStatusSchema } from './threat-status.entity';

// Analysis result structures
export {
  type AnalysisResult,
  type AnalysisStatus,
  type RecipientAnalysisResult,
  type ContractAnalysisResult,
  type ThreatAnalysisResult,
  AnalysisStatusSchema,
  AnalysisResultBaseSchema,
  RecipientAnalysisResultSchema,
  ContractAnalysisResultSchema,
  ThreatAnalysisResultSchema,
} from './analysis-result.entity';

// API request schemas and types
export {
  type RecipientAnalysisRequestBody,
  type ContractAnalysisRequestBody,
  type ThreatAnalysisRequestBody,
  RecipientAnalysisRequestBodySchema,
  ContractAnalysisRequestBodySchema,
  ThreatAnalysisRequestBodySchema,
} from './api-requests.entity';

// API response schemas and types
export {
  type RecipientAnalysisResponse,
  type ContractAnalysisResponse,
  type ThreatAnalysisResponse,
  type GroupedAnalysisResults,
  RecipientAnalysisResponseSchema,
  ContractAnalysisResponseSchema,
  ThreatAnalysisResponseSchema,
} from './api-responses.entity';
