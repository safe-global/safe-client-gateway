import { AddressInfoHelper } from '../../../../common/address-info/address-info.helper';
import { CustomTransactionMapper } from './custom-transaction.mapper';

const addressInfoHelper = jest.mocked({
  getOrDefault: jest.fn(),
} as unknown as AddressInfoHelper);

describe('Multisig Custom Transaction mapper (Unit)', () => {
  const mapper = new CustomTransactionMapper(addressInfoHelper);

  it('should build a CustomTransactionInfo', async () => {
    expect(mapper).toBeDefined();
  });
});
