import { faker } from '@faker-js/faker';
import { random } from 'lodash';
import { Builder, IBuilder } from '@/__tests__/builder';
import { CreateMessageDto } from '@/routes/messages/entities/create-message.dto.entity';

export function createMessageDtoBuilder(): IBuilder<CreateMessageDto> {
  return new Builder<CreateMessageDto>()
    .with('message', faker.word.words(random(1, 5)))
    .with('safeAppId', faker.number.int())
    .with('signature', faker.string.hexadecimal({ length: 32 }));
}
