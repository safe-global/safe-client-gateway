import { z } from 'zod';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { TypedDataSchema } from '@/domain/messages/entities/typed-data.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

/**
 * Request body schema for recipient analysis endpoint.
 *
 * Used to analyze transaction recipients for security risks including
 * interaction history and potential risks.
 */
export const RecipientAnalysisRequestBodySchema = z.object({
  /**
   * Transaction data payload as a hex string.
   * Contains encoded function calls, parameters, or arbitrary data.
   * For simple transfers: "0x" (empty)
   * For contract calls: encoded function signature + parameters
   */
  data: HexSchema,
});

/**
 * Request body schema for contract analysis endpoint.
 *
 * Used to analyze smart contracts for verification status, interaction
 * history, and potential security risks like unexpected delegatecalls.
 */
export const ContractAnalysisRequestBodySchema = z.object({
  /**
   * Transaction data payload as a hex string.
   * @see RecipientAnalysisRequestBodySchema.data
   */
  data: HexSchema,

  /**
   * Type of operation being performed (Safe-specific).
   * - 0 = CALL - Regular transaction call
   * - 1 = DELEGATECALL - Delegate call (executes in Safe's context)
   * Used to determine security analysis scope and delegatecall risks.
   */
  operation: z.number().int().min(0).max(1),
});

/**
 * Request body schema for EIP-712 typed data threat analysis endpoint.
 *
 *
 * Contains complete Safe transaction parameters or a message to be signed
 * as EIP-712 structured data for comprehensive threat analysis,
 * including signature farming, phishing attempts, and malicious
 * structured data patterns.
 */
export const ThreatAnalysisRequestSchema = z.object({
  /**
   * EIP-712 typed data to analyze for security threats.
   * Contains domain, primaryType, types, and message fields
   * following the EIP-712 standard for structured data signing.
   */
  data: TypedDataSchema,

  /** Address of the transaction signer/wallet */
  walletAddress: AddressSchema,

  /** Optional origin identifier for the request */
  origin: z.string().optional(),
});

/**
 * TypeScript types derived from the Zod schemas.
 */
export type RecipientAnalysisRequestBody = z.infer<
  typeof RecipientAnalysisRequestBodySchema
>;
export type ContractAnalysisRequestBody = z.infer<
  typeof ContractAnalysisRequestBodySchema
>;
export type ThreatAnalysisRequest = z.infer<typeof ThreatAnalysisRequestSchema>;
