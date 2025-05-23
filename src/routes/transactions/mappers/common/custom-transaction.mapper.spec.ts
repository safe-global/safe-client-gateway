import { faker } from '@faker-js/faker';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
  multisendBuilder,
} from '@/domain/data-decoder/v2/entities/__tests__/data-decoded.builder';
import type { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { CustomTransactionInfo } from '@/routes/transactions/entities/custom-transaction.entity';
import { CustomTransactionMapper } from '@/routes/transactions/mappers/common/custom-transaction.mapper';
import { getAddress } from 'viem';

const addressInfoHelper = jest.mocked({
  getOrDefault: jest.fn(),
} as jest.MockedObjectDeep<AddressInfoHelper>);

describe('Multisig Custom Transaction mapper (Unit)', () => {
  let mapper: CustomTransactionMapper;

  beforeEach(() => {
    jest.resetAllMocks();
    mapper = new CustomTransactionMapper(addressInfoHelper);
  });

  it('should build a CustomTransactionInfo with null actionCount', async () => {
    const toAddress = new AddressInfo(faker.finance.ethereumAddress());
    addressInfoHelper.getOrDefault.mockResolvedValue(toAddress);
    const dataSize = faker.number.int();
    const chainId = faker.string.numeric();
    const transaction = multisigTransactionBuilder().build();
    const dataDecoded = dataDecodedBuilder().build();

    const customTransaction = await mapper.mapCustomTransaction(
      transaction,
      dataSize,
      chainId,
      null,
      dataDecoded,
    );

    expect(customTransaction).toBeInstanceOf(CustomTransactionInfo);
    expect(customTransaction).toMatchObject({
      to: toAddress,
      dataSize: dataSize.toString(),
      value: transaction.value,
      methodName: dataDecoded.method,
      actionCount: null,
      isCancellation: false,
    });
  });

  it('should build a CustomTransactionInfo without scientific notation', async () => {
    const toAddress = new AddressInfo(faker.finance.ethereumAddress());
    addressInfoHelper.getOrDefault.mockResolvedValue(toAddress);
    const dataSize = faker.number.int();
    const chainId = faker.string.numeric();
    const transaction = multisigTransactionBuilder()
      .with('value', '1000000000000000000000000') // 1e+24
      .build();
    const dataDecoded = dataDecodedBuilder().build();

    const customTransaction = await mapper.mapCustomTransaction(
      transaction,
      dataSize,
      chainId,
      null,
      dataDecoded,
    );

    expect(customTransaction).toBeInstanceOf(CustomTransactionInfo);
    expect(customTransaction).toMatchObject({
      to: toAddress,
      dataSize: dataSize.toString(),
      value: transaction.value,
      methodName: dataDecoded.method,
      actionCount: null,
      isCancellation: false,
    });
  });

  it('should build a multiSend CustomTransactionInfo with null actionCount', async () => {
    const toAddress = new AddressInfo(faker.finance.ethereumAddress());
    addressInfoHelper.getOrDefault.mockResolvedValue(toAddress);
    const method = 'multiSend';
    const dataSize = faker.number.int();
    const chainId = faker.string.numeric();
    const transaction = multisigTransactionBuilder().build();
    const dataDecoded = dataDecodedBuilder().with('method', method).build();

    const customTransaction = await mapper.mapCustomTransaction(
      transaction,
      dataSize,
      chainId,
      null,
      dataDecoded,
    );

    expect(customTransaction).toBeInstanceOf(CustomTransactionInfo);
    expect(customTransaction).toMatchObject({
      to: toAddress,
      dataSize: dataSize.toString(),
      value: transaction.value,
      methodName: method,
      actionCount: null,
      isCancellation: false,
    });
  });

  it('should build a multiSend CustomTransactionInfo with actionCount', async () => {
    const toAddress = new AddressInfo(faker.finance.ethereumAddress());
    addressInfoHelper.getOrDefault.mockResolvedValue(toAddress);
    const method = 'multiSend';
    const dataSize = faker.number.int();
    const chainId = faker.string.numeric();
    const transaction = multisigTransactionBuilder().build();
    const dataDecoded = dataDecodedBuilder()
      .with('method', method)
      .with('parameters', [
        dataDecodedParameterBuilder()
          .with('name', 'transactions')
          .with('value', [
            faker.string.alphanumeric(),
            faker.string.alphanumeric(),
          ])
          .with('valueDecoded', [
            multisendBuilder().build(),
            multisendBuilder().build(),
            multisendBuilder().build(),
          ])
          .build(),
      ])
      .build();

    const customTransaction = await mapper.mapCustomTransaction(
      transaction,
      dataSize,
      chainId,
      null,
      dataDecoded,
    );

    expect(customTransaction).toBeInstanceOf(CustomTransactionInfo);
    expect(customTransaction).toMatchObject({
      to: toAddress,
      dataSize: dataSize.toString(),
      value: transaction.value,
      methodName: method,
      actionCount: 3,
      isCancellation: false,
    });
  });

  it('should build a cancellation CustomTransactionInfo', async () => {
    const toAddress = new AddressInfo(faker.finance.ethereumAddress());
    addressInfoHelper.getOrDefault.mockResolvedValue(toAddress);
    const method = faker.word.sample();
    const value = '0';
    const dataSize = 0;
    const chainId = faker.string.numeric();
    const transaction = multisigTransactionBuilder()
      .with('to', getAddress(toAddress.value))
      .with('safe', getAddress(toAddress.value))
      .with('value', value)
      .with('operation', 0)
      .with('baseGas', 0)
      .with('gasPrice', '0')
      .with('gasToken', NULL_ADDRESS)
      .with('refundReceiver', NULL_ADDRESS)
      .with('safeTxGas', 0)
      .build();
    const dataDecoded = dataDecodedBuilder().with('method', method).build();

    const customTransaction = await mapper.mapCustomTransaction(
      transaction,
      dataSize,
      chainId,
      null,
      dataDecoded,
    );

    expect(customTransaction).toBeInstanceOf(CustomTransactionInfo);
    expect(customTransaction).toMatchObject({
      to: toAddress,
      dataSize: dataSize.toString(),
      value,
      methodName: method,
      actionCount: null,
      isCancellation: true,
    });
  });

  it('should build a CustomTransactionInfo with humanDescription', async () => {
    const toAddress = new AddressInfo(faker.finance.ethereumAddress());
    addressInfoHelper.getOrDefault.mockResolvedValue(toAddress);
    const dataSize = 0;
    const chainId = faker.string.numeric();
    const transaction = multisigTransactionBuilder().build();
    const humanDescription = 'Send 10 ETH to vitalik.eth';
    const dataDecoded = dataDecodedBuilder().build();

    const customTransaction = await mapper.mapCustomTransaction(
      transaction,
      dataSize,
      chainId,
      humanDescription,
      dataDecoded,
    );

    expect(customTransaction).toBeInstanceOf(CustomTransactionInfo);
    expect(customTransaction).toEqual(
      expect.objectContaining({
        humanDescription,
      }),
    );
  });
});
