import { MessageConfirmationSchema } from '@/domain/messages/entities/schemas/message.schema';
import { z } from 'zod';

// TODO: Move to a shared location as used for other entities
export enum SignatureType {
  ContractSignature = 'CONTRACT_SIGNATURE',
  ApprovedHash = 'APPROVED_HASH',
  Eoa = 'EOA',
  EthSign = 'ETH_SIGN',
}

export type MessageConfirmation = z.infer<typeof MessageConfirmationSchema>;
