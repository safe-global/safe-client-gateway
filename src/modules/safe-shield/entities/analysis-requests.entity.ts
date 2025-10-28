import { z } from 'zod';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { TypedDataSchema } from '@/domain/messages/entities/typed-data.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

/**
 * Request schema for counterparty analysis endpoint.
 *
 * Accepts the minimal Safe transaction payload required to perform
 * combined recipient and contract analysis in a single request.
 */
export const CounterpartyAnalysisRequestSchema = z.object({
  /** Target address for the transaction */
  to: AddressSchema,

  /**
   * Amount of ETH (in wei) being sent with the transaction.
   * Represented as a string to handle large numbers without precision loss.
   */
  value: NumericStringSchema,

  /**
   * Transaction data payload as a hex string.
   * Contains encoded function calls, parameters, or arbitrary data.
   * For simple transfers: "0x" (empty)
   * For contract calls: encoded function signature + parameters
   */
  data: HexSchema,

  /**
   * Type of operation being performed (Safe-specific).
   * - 0 = CALL - Regular transaction call
   * - 1 = DELEGATECALL - Delegate call (executes in Safe's context)
   * Used to determine security analysis scope and delegatecall risks.
   */
  operation: z.nativeEnum(Operation),
});

/**
 * Request schema for EIP-712 typed data threat analysis endpoint.
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

export type ThreatAnalysisRequest = z.infer<typeof ThreatAnalysisRequestSchema>;
