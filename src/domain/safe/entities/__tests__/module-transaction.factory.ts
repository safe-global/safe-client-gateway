import { DataDecoded } from '../../../data-decoder/entities/data-decoded.entity';
import { Operation } from '../operation.entity';
import { faker } from '@faker-js/faker';
import dataDecodedFactory from '../../../data-decoder/entities/__tests__/data-decoded.factory';
import { ModuleTransaction } from '../module-transaction.entity';

export default function (
  blockNumber?: number,
  created?: string,
  data?: string | null,
  dataDecoded?: DataDecoded | null,
  executionDate?: string,
  isSuccessful?: boolean,
  module?: string,
  operation?: Operation,
  safe?: string,
  to?: string,
  transactionHash?: string,
  value?: string | null,
): ModuleTransaction {
  return {
    blockNumber: blockNumber ?? faker.datatype.number(),
    created: created ?? faker.date.recent().toISOString(),
    data: data === undefined ? faker.datatype.hexadecimal() : data,
    dataDecoded: dataDecoded === undefined ? dataDecodedFactory() : dataDecoded,
    executionDate: executionDate ?? faker.date.recent().toISOString(),
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
