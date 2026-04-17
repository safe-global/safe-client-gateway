import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import type { MessageConfirmation } from '@/modules/messages/domain/entities/message-confirmation.entity';

export function messageConfirmationBuilder(): IBuilder<MessageConfirmation> {
  return new Builder<MessageConfirmation>()
    .with('created', faker.date.recent())
    .with('modified', faker.date.recent())
    .with('owner', getAddress(faker.finance.ethereumAddress()))
    .with('signature', faker.string.hexadecimal({ length: 130 }) as Hex)
    .with('signatureType', faker.helpers.objectValue(SignatureType));
}

export function toJson(confirmation: MessageConfirmation): unknown {
  return {
    ...confirmation,
    created: confirmation.created.toISOString(),
    modified: confirmation.modified.toISOString(),
  };
}
