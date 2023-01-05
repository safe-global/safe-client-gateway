import { faker } from '@faker-js/faker';
import { Confirmation } from '../multisig-transaction.entity';
import { Builder } from '../../../common/__tests__/builder';

export class ConfirmationBuilder implements Builder<Confirmation> {
  private owner: string = faker.finance.ethereumAddress();

  private signature: string | null = faker.datatype.hexadecimal();

  private signatureType: string = faker.datatype.string();

  private submissionDate: Date = faker.date.recent();

  private transactionHash: string | null = faker.datatype.hexadecimal();

  withOwner(owner: string) {
    this.owner = owner;
    return this;
  }

  withSignature(signature: string | null) {
    this.signature = signature;
    return this;
  }

  withSignatureType(signatureType: string) {
    this.signatureType = signatureType;
    return this;
  }

  withSubmissionDate(submissionDate: Date) {
    this.submissionDate = submissionDate;
    return this;
  }

  withTransactionHash(transactionHash: string | null) {
    this.transactionHash = transactionHash;
    return this;
  }

  build(): Confirmation {
    return <Confirmation>{
      owner: this.owner,
      signature: this.signature,
      signatureType: this.signatureType,
      submissionDate: this.submissionDate,
      transactionHash: this.transactionHash,
    };
  }

  toJson(): unknown {
    const entity = this.build();
    return {
      ...entity,
      submissionDate: entity.submissionDate.toISOString(),
    };
  }
}
