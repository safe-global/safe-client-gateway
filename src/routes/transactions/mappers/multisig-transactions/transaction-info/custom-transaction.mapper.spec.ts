import { faker } from '@faker-js/faker';
import { MultisigTransactionBuilder } from '../../../../../domain/safe/entities/__tests__/multisig-transaction.factory';
import { AddressInfoHelper } from '../../../../common/address-info/address-info.helper';
import { AddressInfo } from '../../../../common/entities/address-info.entity';
import { CustomTransactionInfo } from '../../../entities/custom-transaction.entity';
import { CustomTransactionMapper } from './custom-transaction.mapper';

const addressInfoHelper = jest.mocked({
  getOrDefault: jest.fn(),
} as unknown as AddressInfoHelper);

describe('Multisig Custom Transaction mapper (Unit)', () => {
  const mapper = new CustomTransactionMapper(addressInfoHelper);

  it('should build a CustomTransactionInfo with null actionCount', async () => {
    const toAddress = new AddressInfo(faker.finance.ethereumAddress());
    addressInfoHelper.getOrDefault.mockResolvedValueOnce(toAddress);
    const method = faker.random.word();
    const value = faker.datatype.number();
    const dataSize = faker.datatype.number();
    const chainId = faker.random.numeric();
    const transaction = new MultisigTransactionBuilder()
      .withDataDecoded({ method })
      .build();

    const customTransaction = await mapper.mapCustomTransaction(
      transaction,
      value,
      dataSize,
      chainId,
    );

    expect(customTransaction).toBeInstanceOf(CustomTransactionInfo);
    expect(customTransaction).toMatchObject({
      to: toAddress,
      dataSize: dataSize.toString(),
      value: value.toString(),
      methodName: method,
      actionCount: null,
      isCancellation: false,
    });
  });

  it('should build a multiSend CustomTransactionInfo with null actionCount', async () => {
    const toAddress = new AddressInfo(faker.finance.ethereumAddress());
    addressInfoHelper.getOrDefault.mockResolvedValueOnce(toAddress);
    const method = 'multiSend';
    const value = faker.datatype.number();
    const dataSize = faker.datatype.number();
    const chainId = faker.random.numeric();
    const transaction = new MultisigTransactionBuilder()
      .withDataDecoded({ method })
      .build();

    const customTransaction = await mapper.mapCustomTransaction(
      transaction,
      value,
      dataSize,
      chainId,
    );

    expect(customTransaction).toBeInstanceOf(CustomTransactionInfo);
    expect(customTransaction).toMatchObject({
      to: toAddress,
      dataSize: dataSize.toString(),
      value: value.toString(),
      methodName: method,
      actionCount: null,
      isCancellation: false,
    });
  });

  it('should build a multiSend CustomTransactionInfo with actionCount', async () => {
    const toAddress = new AddressInfo(faker.finance.ethereumAddress());
    addressInfoHelper.getOrDefault.mockResolvedValueOnce(toAddress);
    const method = 'multiSend';
    const value = faker.datatype.number();
    const dataSize = faker.datatype.number();
    const chainId = faker.random.numeric();
    const transaction = new MultisigTransactionBuilder()
      .withDataDecoded({
        method,
        parameters: [{ name: 'transactions', valueDecoded: [1, 2, 3] }],
      })
      .build();

    const customTransaction = await mapper.mapCustomTransaction(
      transaction,
      value,
      dataSize,
      chainId,
    );

    expect(customTransaction).toBeInstanceOf(CustomTransactionInfo);
    expect(customTransaction).toMatchObject({
      to: toAddress,
      dataSize: dataSize.toString(),
      value: value.toString(),
      methodName: method,
      actionCount: 3,
      isCancellation: false,
    });
  });

  it('should build a cancellation CustomTransactionInfo', async () => {
    const toAddress = new AddressInfo(faker.finance.ethereumAddress());
    addressInfoHelper.getOrDefault.mockResolvedValueOnce(toAddress);
    const method = faker.random.word();
    const value = faker.datatype.number();
    const dataSize = 0;
    const chainId = faker.random.numeric();
    const transaction = new MultisigTransactionBuilder()
      .withTo(toAddress.value)
      .withSafe(toAddress.value)
      .withValue('0')
      .withOperation(0)
      .withBaseGas(0)
      .withGasPrice('0')
      .withGasToken('0x0000000000000000000000000000000000000000')
      .withRefundReceiver('0x0000000000000000000000000000000000000000')
      .withSafeTxGas(0)
      .withDataDecoded({ method })
      .build();

    const customTransaction = await mapper.mapCustomTransaction(
      transaction,
      value,
      dataSize,
      chainId,
    );

    expect(customTransaction).toBeInstanceOf(CustomTransactionInfo);
    expect(customTransaction).toMatchObject({
      to: toAddress,
      dataSize: dataSize.toString(),
      value: value.toString(),
      methodName: method,
      actionCount: null,
      isCancellation: true,
    });
  });
});
