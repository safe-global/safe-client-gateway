import { faker } from '@faker-js/faker';
import { random, range } from 'lodash';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { Message } from '../message.entity';
import {
  messageConfirmationBuilder,
  toJson as messageConfirmationToJson,
} from './message-confirmation.builder';

export function messageBuilder(): IBuilder<Message> {
  return Builder.new<Message>()
    .with('created', faker.date.recent())
    .with('modified', faker.date.recent())
    .with('safe', faker.finance.ethereumAddress())
    .with('message', faker.random.words(random(1, 5)))
    .with('messageHash', faker.datatype.hexadecimal(32))
    .with('proposedBy', faker.finance.ethereumAddress())
    .with('safeAppId', faker.datatype.number())
    .with(
      'confirmations',
      range(random(2, 5)).map(() => messageConfirmationBuilder().build()),
    )
    .with('preparedSignature', faker.datatype.hexadecimal(32));
}

export function toJson(message: Message): unknown {
  return {
    ...message,
    created: message.created.toISOString(),
    modified: message.modified.toISOString(),
    confirmations: message?.confirmations?.map((confirmation) =>
      messageConfirmationToJson(confirmation),
    ),
  };
}
