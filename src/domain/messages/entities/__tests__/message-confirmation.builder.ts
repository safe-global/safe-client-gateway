import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { MessageConfirmation } from '@/domain/messages/entities/message-confirmation.entity';
import { getAddress } from 'viem';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';

export function messageConfirmationBuilder(): IBuilder<MessageConfirmation> {
  return new Builder<MessageConfirmation>()
    .with('created', faker.date.recent())
    .with('modified', faker.date.recent())
    .with('owner', getAddress(faker.finance.ethereumAddress()))
    .with(
      'signature',
      faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
    )
    .with('signatureType', faker.helpers.objectValue(SignatureType));
}

export function toJson(confirmation: MessageConfirmation): unknown {
  return {
    ...confirmation,
    created: confirmation.created.toISOString(),
    modified: confirmation.modified.toISOString(),
  };
}
