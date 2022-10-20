import { faker } from '@faker-js/faker';
import { CreateDelegateDto } from '../create-delegate.entity';

export default function (
  safe?: string,
  delegate?: string,
  delegator?: string,
  signature?: string,
  label?: string,
): CreateDelegateDto {
  return new CreateDelegateDto(
    safe ?? faker.finance.ethereumAddress(),
    delegate ?? faker.finance.ethereumAddress(),
    delegator ?? faker.finance.ethereumAddress(),
    signature ?? faker.datatype.hexadecimal(),
    label ?? faker.random.word(),
  );
}
