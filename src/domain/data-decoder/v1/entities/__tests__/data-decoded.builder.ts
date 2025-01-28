import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type {
  DataDecoded,
  DataDecodedParameter,
} from '@/domain/data-decoder/v1/entities/data-decoded.entity';

export function dataDecodedBuilder(): IBuilder<DataDecoded> {
  return new Builder<DataDecoded>()
    .with('method', faker.string.alphanumeric())
    .with(
      'parameters',
      Array.from({ length: faker.number.int({ min: 0, max: 10 }) }, () =>
        dataDecodedParameterBuilder().build(),
      ),
    );
}

export function dataDecodedParameterBuilder(): IBuilder<DataDecodedParameter> {
  return new Builder<DataDecodedParameter>()
    .with('name', faker.string.alphanumeric())
    .with('type', faker.string.alphanumeric())
    .with('value', faker.string.alphanumeric())
    .with('valueDecoded', {
      [faker.string.alphanumeric()]: faker.string.alphanumeric(),
      [faker.string.alphanumeric()]: faker.string.alphanumeric(),
      [faker.string.alphanumeric()]: faker.string.alphanumeric(),
    });
}
