import { faker } from '@faker-js/faker';
import { DeleteDelegateDto } from '../delete-delegate.entity';

export default function (
  delegate?: string,
  delegator?: string,
  signature?: string,
): DeleteDelegateDto {
  return new DeleteDelegateDto(
    delegate ?? faker.finance.ethereumAddress(),
    delegator ?? faker.finance.ethereumAddress(),
    signature ?? faker.datatype.hexadecimal(),
  );
}
