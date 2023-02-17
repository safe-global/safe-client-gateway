import { MessageConfirmation } from './message-confirmation.entity';

export interface Message {
  created: Date;
  modified: Date;
  safe: string;
  messageHash: string;
  message: string | unknown;
  proposedBy: string;
  safeAppId: number | null;
  confirmations: MessageConfirmation[] | null;
  preparedSignature: string | null;
}
