import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { Estimation } from '../estimation.entity';

export function estimationBuilder(): IBuilder<Estimation> {
  return Builder.new<Estimation>().with('safeTxGas', faker.string.numeric(5));
}
