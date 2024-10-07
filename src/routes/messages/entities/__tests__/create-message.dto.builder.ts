import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { CreateMessageDto } from '@/routes/messages/entities/create-message.dto.entity';

export function createMessageDtoBuilder(): IBuilder<CreateMessageDto> {
  return new Builder<CreateMessageDto>()
    .with('message', faker.word.words({ count: { min: 1, max: 5 } }))
    .with('safeAppId', faker.number.int({ min: 0 }))
    .with('signature', faker.string.hexadecimal({ length: 32 }));
}
