import { MessageConfirmation } from '@/domain/messages/entities/message-confirmation.entity';

export interface Message {
  created: Date;
  modified: Date;
  safe: string;
  messageHash: string;
  message: string | unknown;
  proposedBy: string;
  safeAppId: number | null;
  confirmations: MessageConfirmation[];
  preparedSignature: string | null;
}
