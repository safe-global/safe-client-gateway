import { faker } from '@faker-js/faker';
import { TransferDirection } from '../../entities/transfer-transaction-info.entity';
import { getTransferDirection } from './transfer-direction.helper';

describe('Transfer direction helper (Unit)', () => {
  it('should return Outgoing direction when a Safe is in the from direction', () => {
    const safeAddress = faker.finance.ethereumAddress();
    expect(
      getTransferDirection(
        safeAddress,
        safeAddress,
        faker.finance.ethereumAddress(),
      ),
    ).toBe(TransferDirection.Outgoing);
  });

  it('should return Incoming direction when a Safe is in the to direction', () => {
    const safeAddress = faker.finance.ethereumAddress();
    expect(
      getTransferDirection(
        safeAddress,
        faker.finance.ethereumAddress(),
        safeAddress,
      ),
    ).toBe(TransferDirection.Incoming);
  });

  it('should return Unknown as default', () => {
    const safeAddress = faker.finance.ethereumAddress();
    expect(
      getTransferDirection(
        safeAddress,
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
      ),
    ).toBe(TransferDirection.Unknown);
  });
});
