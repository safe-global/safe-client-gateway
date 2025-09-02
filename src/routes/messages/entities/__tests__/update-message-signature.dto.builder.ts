import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { UpdateMessageSignatureDto } from '@/routes/messages/entities/update-message-signature.entity';
import type { Hex } from 'viem';

export function updateMessageSignatureDtoBuilder(): IBuilder<UpdateMessageSignatureDto> {
  return new Builder<UpdateMessageSignatureDto>().with(
    'signature',
    faker.string.hexadecimal({ length: 130 }) as Hex,
  );
}
