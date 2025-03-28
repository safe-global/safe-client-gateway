import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { DataDecodedAccuracy } from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';
import type {
  DataDecoded,
  DataDecodedParameter,
  MultisendSchema,
} from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import type { z } from 'zod';

export function multisendBuilder(): IBuilder<z.infer<typeof MultisendSchema>> {
  return (
    new Builder<z.infer<typeof MultisendSchema>>()
      .with('operation', faker.helpers.arrayElement([0, 1]))
      .with('value', faker.string.numeric())
      // No nested data to prevent call stack exceeded
      .with('dataDecoded', null)
      .with('to', getAddress(faker.finance.ethereumAddress()))
      .with('data', faker.string.hexadecimal() as `0x${string}`)
  );
}

export function dataDecodedParameterBuilder(): IBuilder<DataDecodedParameter> {
  const valueDecoded = faker.datatype.boolean()
    ? faker.helpers.multiple(() => multisendBuilder().build(), {
        count: { min: 1, max: 3 },
      })
    : baseDataDecodedBuilder().build();
  return new Builder<DataDecodedParameter>()
    .with('name', faker.word.noun())
    .with('type', faker.word.noun())
    .with('value', faker.string.numeric())
    .with('valueDecoded', valueDecoded);
}

export function baseDataDecodedBuilder(): IBuilder<
  Omit<DataDecoded, 'accuracy'>
> {
  return new Builder<DataDecoded>().with('method', faker.word.noun()).with(
    'parameters',
    // One parameter to prevent call stack exceeded
    [dataDecodedParameterBuilder().build()],
  );
}

export function dataDecodedBuilder(): IBuilder<DataDecoded> {
  const baseDataDecoded = baseDataDecodedBuilder().build();
  return new Builder<DataDecoded>()
    .with('method', baseDataDecoded.method)
    .with('parameters', baseDataDecoded.parameters)
    .with('accuracy', faker.helpers.arrayElement(DataDecodedAccuracy));
}
