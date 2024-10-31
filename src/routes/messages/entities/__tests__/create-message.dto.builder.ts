import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { CreateMessageDto } from '@/routes/messages/entities/create-message.dto.entity';
import { fakeJson } from '@/__tests__/faker';

export function createMessageDtoBuilder(): IBuilder<CreateMessageDto> {
  return new Builder<CreateMessageDto>()
    .with('message', faker.word.words({ count: { min: 1, max: 5 } }))
    .with('signature', faker.string.hexadecimal({ length: 32 }))
    .with('origin', fakeJson());
}
