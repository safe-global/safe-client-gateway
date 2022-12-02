import { ERC721Transfer } from '../transfer.entity';
import { faker } from '@faker-js/faker';

export default function (
  blockNumber?: number,
  executionDate?: Date,
  from?: string,
  to?: string,
  transactionHash?: string,
  tokenAddress?: string | null,
  tokenId?: string,
): ERC721Transfer {
  return <ERC721Transfer>{
    blockNumber: blockNumber ?? faker.datatype.number({ min: 0 }),
    executionDate: executionDate ?? faker.date.recent(),
    from: from ?? faker.finance.ethereumAddress(),
    to: to ?? faker.finance.ethereumAddress(),
    transactionHash: transactionHash ?? faker.datatype.hexadecimal(),
    tokenAddress:
      tokenAddress === undefined
        ? faker.finance.ethereumAddress()
        : tokenAddress,
    tokenId: tokenId ?? faker.datatype.string(),
  };
}
