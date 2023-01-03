import { DataDecoded } from '../../../data-decoder/entities/data-decoded.entity';
import { Operation } from '../operation.entity';
import { faker } from '@faker-js/faker';
import dataDecodedFactory from '../../../data-decoder/entities/__tests__/data-decoded.factory';

export default function (
  blockNumber?: number,
  created?: Date,
  data?: string | null,
  dataDecoded?: DataDecoded | null,
  executionDate?: Date,
  isSuccessful?: boolean,
  module?: string,
  operation?: Operation,
  safe?: string,
  to?: string,
  transactionHash?: string,
  value?: string | null,
) {
  return {
    blockNumber: blockNumber ?? faker.datatype.number(),
    created: created?.toISOString() ?? faker.date.recent().toISOString(),
    data: data === undefined ? faker.datatype.hexadecimal() : data,
    dataDecoded: dataDecoded === undefined ? dataDecodedFactory() : dataDecoded,
    executionDate:
      executionDate?.toISOString() ?? faker.date.recent().toISOString(),
    isSuccessful: isSuccessful ?? faker.datatype.boolean(),
    module: module ?? faker.finance.ethereumAddress(),
    operation: operation ?? faker.helpers.arrayElement([0, 1]),
    safe: safe ?? faker.finance.ethereumAddress(),
    to: to ?? faker.finance.ethereumAddress(),
    transactionHash: transactionHash ?? faker.datatype.hexadecimal(),
    value:
      value === undefined ? faker.datatype.hexadecimal() : (value as string),
  };
}
