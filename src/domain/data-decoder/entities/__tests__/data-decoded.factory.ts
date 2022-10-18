import { faker } from '@faker-js/faker';
import { DataDecoded, DataDecodedParameter } from '../data-decoded.entity';

export default function (
  method?: string,
  parameters?: DataDecodedParameter,
): DataDecoded {
  return <DataDecoded>{
    method: method ?? faker.random.alphaNumeric(),
    parameters:
      parameters ?? [...Array(5)].map(() => dataDecodedParameterFactory()),
  };
}

function dataDecodedParameterFactory(): DataDecodedParameter {
  return <DataDecodedParameter>{
    name: faker.random.alphaNumeric(),
    type: faker.random.alphaNumeric(),
    value: faker.random.alphaNumeric(),
    valueDecoded: {
      [faker.random.alphaNumeric()]: faker.random.alphaNumeric(),
      [faker.random.alphaNumeric()]: faker.random.alphaNumeric(),
      [faker.random.alphaNumeric()]: faker.random.alphaNumeric(),
    },
  };
}
