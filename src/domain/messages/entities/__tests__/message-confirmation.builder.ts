import { faker } from '@faker-js/faker';
import { sample } from 'lodash';
import { Builder, IBuilder } from '@/__tests__/builder';
import {
  MessageConfirmation,
  SignatureType,
} from '@/domain/messages/entities/message-confirmation.entity';

export function messageConfirmationBuilder(): IBuilder<MessageConfirmation> {
  return Builder.new<MessageConfirmation>()
    .with('created', faker.date.recent())
    .with('modified', faker.date.recent())
    .with('owner', faker.finance.ethereumAddress())
    .with('signature', faker.string.hexadecimal({ length: 32 }))
    .with(
      'signatureType',
      sample(Object.values(SignatureType)) ?? SignatureType.ContractSignature,
    );
}

export function toJson(confirmation: MessageConfirmation): unknown {
  return {
    ...confirmation,
    created: confirmation.created.toISOString(),
    modified: confirmation.modified.toISOString(),
  };
}
