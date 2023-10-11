import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import {
  DataDecoded,
  DataDecodedParameter,
} from '@/domain/data-decoder/entities/data-decoded.entity';

export function dataDecodedBuilder(): IBuilder<DataDecoded> {
  return Builder.new<DataDecoded>()
    .with('method', faker.string.alphanumeric())
    .with(
      'parameters',
      Array.from({ length: faker.number.int({ min: 0, max: 10 }) }, () =>
        dataDecodedParameterBuilder().build(),
      ),
    );
}

export function dataDecodedParameterBuilder(): IBuilder<DataDecodedParameter> {
  return Builder.new<DataDecodedParameter>()
    .with('name', faker.string.alphanumeric())
    .with('type', faker.string.alphanumeric())
    .with('value', faker.string.alphanumeric())
    .with('valueDecoded', {
      [faker.string.alphanumeric()]: faker.string.alphanumeric(),
      [faker.string.alphanumeric()]: faker.string.alphanumeric(),
      [faker.string.alphanumeric()]: faker.string.alphanumeric(),
    });
}
