import { SignatureType } from '../../../domain/messages/entities/message-confirmation.entity';

export interface CreatedMessageConfirmation {
  created: Date;
  modified: Date;
  owner: string;
  signature: string;
  signatureType: SignatureType;
}
