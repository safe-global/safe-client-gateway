import { faker } from '@faker-js/faker';
import { Delegate } from '../delegate.entity';
export default function (
  safe?: string,
  delegate?: string,
  delegator?: string,
  label?: boolean,
): Delegate {
  return <Delegate>{
    safe: safe ?? faker.random.word(),
    delegate: delegate ?? faker.random.word(),
    delegator: delegator ?? faker.random.word(),
    label: label ?? faker.random.word(),
  };
}
