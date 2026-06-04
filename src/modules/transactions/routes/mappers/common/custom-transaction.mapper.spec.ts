// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
  multisendBuilder,
} from '@/modules/data-decoder/domain/v2/entities/__tests__/data-decoded.builder';
import { multisigTransactionBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import {
  CustomTransactionInfo,
  MultiSendTransactionInfo,
} from '@/modules/transactions/routes/entities/custom-transaction.entity';
import { CustomTransactionMapper } from '@/modules/transactions/routes/mappers/common/custom-transaction.mapper';
import type { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';

const addressInfoHelper = vi.mocked({
  getOrDefault: vi.fn(),
} as MockedObject<AddressInfoHelper>);

describe('Multisig Custom Transaction mapper (Unit)', () => {
  let mapper: CustomTransactionMapper;

  beforeEach(() => {
    vi.resetAllMocks();
    mapper = new CustomTransactionMapper(addressInfoHelper);
  });

  it('should build a CustomTransactionInfo for non-multiSend transactions', async () => {
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
      isCancellation: false,
    });
  });

  it('should build a MultiSendTransactionInfo with default actionCount when parameters are missing', async () => {
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

    expect(customTransaction).toBeInstanceOf(MultiSendTransactionInfo);
    expect(customTransaction).toMatchObject({
      to: toAddress,
      dataSize: dataSize.toString(),
      value: transaction.value,
      methodName: 'multiSend',
      actionCount: 0,
      isCancellation: false,
    });
  });

  it('should build a MultiSendTransactionInfo with correct actionCount', async () => {
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

    expect(customTransaction).toBeInstanceOf(MultiSendTransactionInfo);
    expect(customTransaction).toMatchObject({
      to: toAddress,
      dataSize: dataSize.toString(),
      value: transaction.value,
      methodName: 'multiSend',
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
      isCancellation: true,
    });
  });

  it('should build a cancellation CustomTransactionInfo (empty refund params)', async () => {
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
      .with('baseGas', faker.helpers.arrayElement([null, 0]))
      .with('gasPrice', faker.helpers.arrayElement([null, '0']))
      .with('gasToken', faker.helpers.arrayElement([null, NULL_ADDRESS]))
      .with('refundReceiver', faker.helpers.arrayElement([null, NULL_ADDRESS]))
      .with('safeTxGas', faker.helpers.arrayElement([null, 0]))
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
      isCancellation: true,
    });
  });

  it('should build a cancellation CustomTransactionInfo (non-zero refund params, native gas token)', async () => {
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
      .with('baseGas', faker.number.int({ min: 1 }))
      .with('gasPrice', faker.string.numeric({ exclude: ['0'] }))
      .with('gasToken', NULL_ADDRESS)
      .with('refundReceiver', getAddress(faker.finance.ethereumAddress()))
      .with('safeTxGas', faker.number.int({ min: 1 }))
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
      isCancellation: true,
    });
  });

  it('should build a cancellation CustomTransactionInfo (non-zero refund params, ERC-20 gas token)', async () => {
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
      .with('baseGas', faker.number.int({ min: 1 }))
      .with('gasPrice', faker.string.numeric({ exclude: ['0'] }))
      .with('gasToken', getAddress(faker.finance.ethereumAddress()))
      .with('refundReceiver', getAddress(faker.finance.ethereumAddress()))
      .with('safeTxGas', faker.number.int({ min: 1 }))
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
      isCancellation: true,
    });
  });

  it('should not classify as cancellation when only some required refund params are non-zero', async () => {
    const toAddress = new AddressInfo(faker.finance.ethereumAddress());
    addressInfoHelper.getOrDefault.mockResolvedValue(toAddress);
    const method = faker.word.sample();
    const dataSize = 0;
    const chainId = faker.string.numeric();
    const dataDecoded = dataDecodedBuilder().with('method', method).build();
    // Builder.with() mutates and returns `this`, so each case must start from a
    // fresh builder — otherwise prior overrides leak into subsequent cases.
    const baseTransactionBuilder = (): ReturnType<
      typeof multisigTransactionBuilder
    > =>
      multisigTransactionBuilder()
        .with('to', getAddress(toAddress.value))
        .with('safe', getAddress(toAddress.value))
        .with('value', '0')
        .with('operation', 0)
        .with('baseGas', faker.number.int({ min: 1 }))
        .with('gasPrice', faker.string.numeric({ exclude: ['0'] }))
        .with('gasToken', NULL_ADDRESS)
        .with('refundReceiver', getAddress(faker.finance.ethereumAddress()))
        .with('safeTxGas', faker.number.int({ min: 1 }));

    const safeTxWithSafeTxGasZero = await mapper.mapCustomTransaction(
      baseTransactionBuilder().with('safeTxGas', 0).build(),
      dataSize,
      chainId,
      null,
      dataDecoded,
    );
    expect(safeTxWithSafeTxGasZero).toBeInstanceOf(CustomTransactionInfo);
    expect(
      (safeTxWithSafeTxGasZero as CustomTransactionInfo).isCancellation,
    ).toBe(false);

    const safeTxWithBaseGasZero = await mapper.mapCustomTransaction(
      baseTransactionBuilder().with('baseGas', 0).build(),
      dataSize,
      chainId,
      null,
      dataDecoded,
    );
    expect(safeTxWithBaseGasZero).toBeInstanceOf(CustomTransactionInfo);
    expect(
      (safeTxWithBaseGasZero as CustomTransactionInfo).isCancellation,
    ).toBe(false);

    const safeTxWithGasPriceZero = await mapper.mapCustomTransaction(
      baseTransactionBuilder().with('gasPrice', '0').build(),
      dataSize,
      chainId,
      null,
      dataDecoded,
    );
    expect(safeTxWithGasPriceZero).toBeInstanceOf(CustomTransactionInfo);
    expect(
      (safeTxWithGasPriceZero as CustomTransactionInfo).isCancellation,
    ).toBe(false);

    const safeTxWithRefundReceiverZero = await mapper.mapCustomTransaction(
      baseTransactionBuilder().with('refundReceiver', NULL_ADDRESS).build(),
      dataSize,
      chainId,
      null,
      dataDecoded,
    );
    expect(safeTxWithRefundReceiverZero).toBeInstanceOf(CustomTransactionInfo);
    expect(
      (safeTxWithRefundReceiverZero as CustomTransactionInfo).isCancellation,
    ).toBe(false);

    // gasToken === null must not be treated as cancellation, even when every
    // other refund param is non-zero/non-null (i.e. the non-zero branch).
    const safeTxWithGasTokenNull = await mapper.mapCustomTransaction(
      baseTransactionBuilder().with('gasToken', null).build(),
      dataSize,
      chainId,
      null,
      dataDecoded,
    );
    expect(safeTxWithGasTokenNull).toBeInstanceOf(CustomTransactionInfo);
    expect(
      (safeTxWithGasTokenNull as CustomTransactionInfo).isCancellation,
    ).toBe(false);

    const safeTxWithOnlyGasTokenNonZero = await mapper.mapCustomTransaction(
      baseTransactionBuilder()
        .with('baseGas', 0)
        .with('gasPrice', '0')
        .with('gasToken', getAddress(faker.finance.ethereumAddress()))
        .with('refundReceiver', NULL_ADDRESS)
        .with('safeTxGas', 0)
        .build(),
      dataSize,
      chainId,
      null,
      dataDecoded,
    );
    expect(safeTxWithOnlyGasTokenNonZero).toBeInstanceOf(CustomTransactionInfo);
    expect(
      (safeTxWithOnlyGasTokenNonZero as CustomTransactionInfo).isCancellation,
    ).toBe(false);
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
