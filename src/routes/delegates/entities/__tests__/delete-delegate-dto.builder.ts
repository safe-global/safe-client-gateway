import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { CreateDelegateDto } from '../create-delegate.entity';

export function deleteDelegateDtoBuilder(): IBuilder<CreateDelegateDto> {
  return Builder.new<CreateDelegateDto>()
    .with('delegate', faker.finance.ethereumAddress())
    .with('delegator', faker.finance.ethereumAddress())
    .with('signature', faker.datatype.hexadecimal(32));
}
