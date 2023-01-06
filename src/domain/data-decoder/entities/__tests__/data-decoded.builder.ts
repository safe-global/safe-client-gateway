import { faker } from '@faker-js/faker';
import { DataDecoded, DataDecodedParameter } from '../data-decoded.entity';
import { Builder, IBuilder } from '../../../../__tests__/builder';

export function dataDecodedBuilder(): IBuilder<DataDecoded> {
  return Builder.new<DataDecoded>()
    .with('method', faker.random.alphaNumeric())
    .with(
      'parameters',
      Array.from({ length: faker.datatype.number({ min: 0, max: 10 }) }, () =>
        dataDecodedParameterBuilder().build(),
      ),
    );
}

export function dataDecodedParameterBuilder(): IBuilder<DataDecodedParameter> {
  return Builder.new<DataDecodedParameter>()
    .with('name', faker.random.alphaNumeric())
    .with('type', faker.random.alphaNumeric())
    .with('value', faker.random.alphaNumeric())
    .with('valueDecoded', {
      [faker.random.alphaNumeric()]: faker.random.alphaNumeric(),
      [faker.random.alphaNumeric()]: faker.random.alphaNumeric(),
      [faker.random.alphaNumeric()]: faker.random.alphaNumeric(),
    });
}
