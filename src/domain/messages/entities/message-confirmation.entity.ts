import { MessageConfirmationSchema } from '@/domain/messages/entities/schemas/message.schema';
import { z } from 'zod';

export enum SignatureType {
  ContractSignature = 'CONTRACT_SIGNATURE',
  ApprovedHash = 'APPROVED_HASH',
  Eoa = 'EOA',
  EthSign = 'ETH_SIGN',
}

export type MessageConfirmation = z.infer<typeof MessageConfirmationSchema>;
