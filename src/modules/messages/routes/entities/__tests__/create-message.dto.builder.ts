import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { CreateMessageDto } from '@/modules/messages/routes/entities/create-message.dto.entity';
import { fakeJson } from '@/__tests__/faker';
import type { Hex } from 'viem';

const SIGNATURE_LENGTH = 130;

export function createMessageDtoBuilder(): IBuilder<CreateMessageDto> {
  return new Builder<CreateMessageDto>()
    .with('message', faker.word.words({ count: { min: 1, max: 5 } }))
    .with(
      'signature',
      faker.string.hexadecimal({ length: SIGNATURE_LENGTH }) as Hex,
    )
    .with('origin', fakeJson());
}
