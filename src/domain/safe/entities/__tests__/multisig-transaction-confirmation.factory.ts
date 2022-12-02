import { Confirmation } from '../multisig-transaction.entity';
import { faker } from '@faker-js/faker';

export default function (
  owner?: string,
  signature?: string,
  signatureType?: string,
  submissionDate?: Date,
  transactionHash?: string,
): Confirmation {
  return <Confirmation>{
    owner: owner ?? faker.finance.ethereumAddress(),
    signature:
      signature === undefined ? faker.datatype.hexadecimal() : signature,
    signatureType: signatureType ?? faker.datatype.string(),
    submissionDate: submissionDate ?? faker.date.recent(),
    transactionHash:
      transactionHash === undefined
        ? faker.datatype.hexadecimal()
        : transactionHash,
  };
}
