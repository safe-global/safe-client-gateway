import {
  Confirmation,
  MultisigTransaction,
} from '../multisig-transaction.entity';
import { Operation } from '../operation.entity';
import { faker } from '@faker-js/faker';
import multisigTransactionConfirmationFactory from './multisig-transaction-confirmation.factory';
import { Builder } from '../../../common/__tests__/builder';

export class MultisigTransactionBuilder
  implements Builder<MultisigTransaction>
{
  private baseGas: number = faker.datatype.number();
  private blockNumber: number = faker.datatype.number();
  private confirmations: Confirmation[] = [
    multisigTransactionConfirmationFactory(),
  ];
  private confirmationsRequired: number = faker.datatype.number();
  private data: string = faker.datatype.hexadecimal();
  private dataDecoded: any = faker.datatype.json();
  private ethGasPrice: string = faker.datatype.hexadecimal();
  private executionDate: Date = faker.date.recent();
  private executor: string = faker.finance.ethereumAddress();
  private fee: string = faker.datatype.hexadecimal();
  private gasPrice: string = faker.datatype.hexadecimal();
  private gasToken: string = faker.finance.ethereumAddress();
  private gasUsed: number = faker.datatype.number();
  private isExecuted: boolean = faker.datatype.boolean();
  private isSuccessful: boolean = faker.datatype.boolean();
  private modified: Date = faker.date.recent();
  private nonce: number = faker.datatype.number();
  private operation: Operation = faker.helpers.arrayElement([0, 1]);
  private origin: string = faker.internet.url();
  private refundReceiver: string = faker.finance.ethereumAddress();
  private safe: string = faker.finance.ethereumAddress();
  private safeTxGas: number = faker.datatype.number();
  private safeTxHash: string = faker.datatype.hexadecimal();
  private signatures: string = faker.datatype.hexadecimal();
  private submissionDate: Date = faker.date.recent();
  private to: string = faker.finance.ethereumAddress();
  private transactionHash: string = faker.datatype.hexadecimal();
  private value: string = faker.datatype.hexadecimal();

  withBaseGas(baseGas: number) {
    this.baseGas = baseGas;
    return this;
  }

  withBlockNumber(blockNumber: number) {
    this.blockNumber = blockNumber;
    return this;
  }

  withConfirmations(confirmations: Confirmation[]) {
    this.confirmations = confirmations;
    return this;
  }

  withConfirmationsRequired(confirmationRequired: number) {
    this.confirmationsRequired = confirmationRequired;
    return this;
  }

  withData(data: string) {
    this.data = data;
    return this;
  }

  withDataDecoded(dataDecoded: any) {
    this.dataDecoded = dataDecoded;
    return this;
  }

  withEthGasPrice(ethGasPrice: string) {
    this.ethGasPrice = ethGasPrice;
    return this;
  }

  withExecutionDate(executionDate: Date) {
    this.executionDate = executionDate;
    return this;
  }

  withExecutor(executor: string) {
    this.executor = executor;
    return this;
  }

  withFee(fee: string) {
    this.fee = fee;
    return this;
  }

  withGasPrice(gasPrice: string) {
    this.gasPrice = gasPrice;
    return this;
  }

  withGasToken(gasToken: string) {
    this.gasToken = gasToken;
    return this;
  }

  withGasUsed(gasUsed: number) {
    this.gasUsed = gasUsed;
    return this;
  }

  withIsExecuted(isExecuted: boolean) {
    this.isExecuted = isExecuted;
    return this;
  }

  withIsSuccessful(isSuccessful: boolean) {
    this.isSuccessful = isSuccessful;
    return this;
  }

  withModified(modified: Date) {
    this.modified = modified;
    return this;
  }

  withNonce(nonce: number) {
    this.nonce = nonce;
    return this;
  }

  withOperation(operation: Operation) {
    this.operation = operation;
    return this;
  }

  withOrigin(origin: string) {
    this.origin = origin;
    return this;
  }

  withRefundReceiver(refundReceiver: string) {
    this.refundReceiver = refundReceiver;
    return this;
  }

  withSafe(safe: string) {
    this.safe = safe;
    return this;
  }

  withSafeTxGas(safeTxGas: number) {
    this.safeTxGas = safeTxGas;
    return this;
  }

  withSignatures(signatures: string) {
    this.signatures = signatures;
    return this;
  }

  withSubmissionDate(submissionDate: Date) {
    this.submissionDate = submissionDate;
    return this;
  }

  withTo(to: string) {
    this.to = to;
    return this;
  }

  withTransactionHash(transactionHash: string) {
    this.transactionHash = transactionHash;
    return this;
  }

  withValue(value: string) {
    this.value = value;
    return this;
  }

  build(): MultisigTransaction {
    return <MultisigTransaction>{
      baseGas: this.baseGas,
      blockNumber: this.blockNumber,
      confirmations: this.confirmations,
      confirmationsRequired: this.confirmationsRequired,
      data: this.data,
      dataDecoded: this.dataDecoded,
      ethGasPrice: this.ethGasPrice,
      executionDate: this.executionDate,
      executor: this.executor,
      fee: this.fee,
      gasPrice: this.gasPrice,
      gasToken: this.gasToken,
      gasUsed: this.gasUsed,
      isExecuted: this.isExecuted,
      isSuccessful: this.isSuccessful,
      modified: this.modified,
      nonce: this.nonce,
      operation: this.operation,
      origin: this.origin,
      refundReceiver: this.refundReceiver,
      safe: this.safe,
      safeTxGas: this.safeTxGas,
      safeTxHash: this.safeTxHash,
      signatures: this.signatures,
      submissionDate: this.submissionDate,
      to: this.to,
      transactionHash: this.transactionHash,
      value: this.value,
    };
  }
}
