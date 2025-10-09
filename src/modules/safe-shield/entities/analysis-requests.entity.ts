import { z } from 'zod';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

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
 * Request body schema for threat analysis endpoint.
 *
 * Contains complete Safe transaction parameters for comprehensive
 * threat analysis including malicious pattern detection and
 * Safe-specific security risks.
 */
export const ThreatAnalysisRequestBodySchema = z.object({
  /** Target address for the transaction */
  to: AddressSchema,

  /**
   * Amount of ETH (in wei) being sent with the transaction.
   * Represented as a string to handle large numbers without precision loss.
   * Example: "1000000000000000000" for 1 ETH
   */
  value: NumericStringSchema,

  /**
   * Transaction data payload as a hex string.
   * @see RecipientAnalysisRequestBodySchema.data
   */
  data: HexSchema,

  /**
   * Type of operation being performed.
   * @see ContractAnalysisRequestBodySchema.operation
   */
  operation: z.number().int().min(0).max(1),

  /** Gas limit for the Safe transaction execution */
  safeTxGas: NumericStringSchema,

  /** Base gas for the Safe transaction */
  baseGas: NumericStringSchema,

  /** Gas price for the transaction */
  gasPrice: NumericStringSchema,

  /** Token address for gas payment (address(0) for ETH) */
  gasToken: AddressSchema,

  /** Address to receive gas payment refund */
  refundReceiver: AddressSchema,

  /** Safe transaction nonce */
  nonce: NumericStringSchema,

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
export type ThreatAnalysisRequestBody = z.infer<
  typeof ThreatAnalysisRequestBodySchema
>;
