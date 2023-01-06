import { faker } from '@faker-js/faker';
import { Builder } from '../../../common/__tests__/builder';
import { ERC20Transfer } from '../transfer.entity';

export class ERC20TransferBuilder implements Builder<ERC20Transfer> {
  private blockNumber: number = faker.datatype.number();

  private executionDate: Date = faker.date.recent();

  private from: string = faker.finance.ethereumAddress();

  private to: string = faker.finance.ethereumAddress();

  private transactionHash: string = faker.datatype.string();

  private tokenAddress: string = faker.finance.ethereumAddress();

  private value: string = faker.datatype.hexadecimal();

  withBlockNumber(blockNumber: number) {
    this.blockNumber = blockNumber;
    return this;
  }

  withExecutionDate(executionDate: Date) {
    this.executionDate = executionDate;
    return this;
  }

  withFrom(from: string) {
    this.from = from;
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

  withTokenAddress(tokenAddress: string) {
    this.tokenAddress = tokenAddress;
    return this;
  }

  withValue(value: string) {
    this.value = value;
    return this;
  }

  build(): ERC20Transfer {
    return <ERC20Transfer>{
      blockNumber: this.blockNumber,
      executionDate: this.executionDate,
      from: this.from,
      to: this.to,
      transactionHash: this.transactionHash,
      tokenAddress: this.tokenAddress,
      value: this.value,
    };
  }

  toJson(): unknown {
    const entity = this.build();
    return {
      type: 'ERC20_TRANSFER',
      ...entity,
      executionDate: this.executionDate.toISOString(),
    };
  }
}
