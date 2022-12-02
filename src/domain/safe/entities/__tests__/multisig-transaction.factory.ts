import {
  Confirmation,
  MultisigTransaction,
} from '../multisig-transaction.entity';
import { Operation } from '../operation.entity';
import { faker } from '@faker-js/faker';
import multisigTransactionConfirmationFactory from './multisig-transaction-confirmation.factory';

export default function (
  baseGas?: number | null,
  blockNumber?: number | null,
  confirmations?: Confirmation[] | null,
  confirmationsRequired?: number | null,
  data?: string | null,
  dataDecoded?: any | null,
  ethGasPrice?: string | null,
  executionDate?: Date | null,
  executor?: string | null,
  fee?: string | null,
  gasPrice?: string | null,
  gasToken?: string | null,
  gasUsed?: number | null,
  isExecuted?: boolean,
  isSuccessful?: boolean | null,
  modified?: Date | null,
  nonce?: number,
  operation?: Operation,
  origin?: string | null,
  refundReceiver?: string | null,
  safe?: string,
  safeTxGas?: number | null,
  safeTxHash?: string,
  signatures?: string | null,
  submissionDate?: Date | null,
  to?: string,
  transactionHash?: string | null,
  value?: string | null,
): MultisigTransaction {
  return <MultisigTransaction>{
    baseGas: baseGas === undefined ? faker.datatype.number() : baseGas,
    blockNumber:
      blockNumber === undefined ? faker.datatype.number() : blockNumber,
    confirmations:
      confirmations === undefined
        ? [multisigTransactionConfirmationFactory()]
        : confirmations,
    confirmationsRequired:
      confirmationsRequired === confirmationsRequired
        ? faker.datatype.number({ min: 0 })
        : confirmationsRequired,
    data: data === undefined ? faker.datatype.hexadecimal() : data,
    dataDecoded:
      dataDecoded === undefined ? faker.datatype.json() : dataDecoded,
    ethGasPrice:
      ethGasPrice === undefined ? faker.datatype.hexadecimal() : ethGasPrice,
    executionDate:
      executionDate === undefined ? faker.date.recent() : executionDate,
    executor:
      executor === undefined ? faker.finance.ethereumAddress() : executor,
    fee: fee === undefined ? faker.datatype.hexadecimal() : fee,
    gasPrice: gasPrice === undefined ? faker.datatype.hexadecimal() : gasPrice,
    gasToken:
      gasToken === undefined ? faker.finance.ethereumAddress() : gasToken,
    gasUsed:
      gasUsed === undefined ? faker.datatype.number({ min: 0 }) : gasUsed,
    isExecuted: isExecuted ?? faker.datatype.boolean(),
    isSuccessful:
      isSuccessful === undefined ? faker.datatype.boolean() : isSuccessful,
    modified: modified === undefined ? faker.date.recent() : modified,
    nonce: nonce ?? faker.datatype.number({ min: 0 }),
    operation: operation ?? faker.helpers.arrayElement([0, 1]),
    origin: origin === undefined ? faker.internet.url() : origin,
    refundReceiver:
      refundReceiver === undefined
        ? faker.finance.ethereumAddress()
        : refundReceiver,
    safe: safe ?? faker.finance.ethereumAddress(),
    safeTxGas:
      safeTxGas === undefined ? faker.datatype.number({ min: 0 }) : safeTxGas,
    safeTxHash: safeTxHash ?? faker.datatype.hexadecimal(),
    signatures:
      signatures === undefined ? faker.datatype.hexadecimal() : signatures,
    submissionDate:
      submissionDate === undefined ? faker.date.recent() : submissionDate,
    to: to ?? faker.finance.ethereumAddress(),
    transactionHash:
      transactionHash === undefined
        ? faker.datatype.hexadecimal()
        : transactionHash,
    value: value === undefined ? faker.datatype.hexadecimal() : value,
  };
}
