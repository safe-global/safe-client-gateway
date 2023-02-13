import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { CreateDelegateDto } from '../create-delegate.entity';

export function createDelegateDtoBuilder(): IBuilder<CreateDelegateDto> {
  return Builder.new<CreateDelegateDto>()
    .with('safe', faker.finance.ethereumAddress())
    .with('delegate', faker.finance.ethereumAddress())
    .with('delegator', faker.finance.ethereumAddress())
    .with('signature', faker.datatype.hexadecimal(32))
    .with('label', faker.datatype.hexadecimal(32));
}
