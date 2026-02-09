import { z } from 'zod';
import { TypedDataSchema } from '@/modules/messages/domain/entities/typed-data.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { TransactionBaseSchema } from '@/domain/common/schemas/transaction-base.schema';

/**
 * Request schema for counterparty analysis endpoint.
 *
 * Accepts the minimal Safe transaction payload required to perform
 * combined recipient and contract analysis in a single request.
 *
 * Uses the same structure as TransactionBaseSchema for consistency and reusability.
 */
export const CounterpartyAnalysisRequestSchema = TransactionBaseSchema;

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
