import { faker } from '@faker-js/faker';
import { Delegate } from '../delegate.entity';
export default function (
  safe?: string,
  delegate?: string,
  delegator?: string,
  label?: boolean,
): Delegate {
  return <Delegate>{
    safe: safe ?? faker.finance.ethereumAddress(),
    delegate: delegate ?? faker.finance.ethereumAddress(),
    delegator: delegator ?? faker.finance.ethereumAddress(),
    label: label ?? faker.random.word(),
  };
}
