import { MultisigTransactionInfoMapper } from './multisig-transaction-info.mapper';
import { MultisigTransactionStatusMapper } from './multisig-transaction-status.mapper';
import { MultisigTransactionMapper } from './multisig-transaction.mapper';

const statusMapper = jest.mocked(
  {} as unknown as MultisigTransactionStatusMapper,
);
const infoMapper = jest.mocked({} as unknown as MultisigTransactionInfoMapper);

describe('Multisig Transaction mapper (Unit)', () => {
  const mapper = new MultisigTransactionMapper(statusMapper, infoMapper);

  it('', () => {
    expect(mapper).toBeDefined(); // TODO:
  });
});
