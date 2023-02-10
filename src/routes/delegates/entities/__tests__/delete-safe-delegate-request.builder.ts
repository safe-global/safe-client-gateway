import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { DeleteSafeDelegateRequest } from '../delete-safe-delegate-request.entity';

export function DeleteSafeDelegateBuilder(): IBuilder<DeleteSafeDelegateRequest> {
  return Builder.new<DeleteSafeDelegateRequest>()
    .with('delegate', faker.finance.ethereumAddress())
    .with('safe', faker.finance.ethereumAddress())
    .with('signature', faker.datatype.hexadecimal(32));
}
