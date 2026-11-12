// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { toHex, zeroAddress } from 'viem';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { toSafenetConsensusTransaction } from '#/modules/safenet/domain/safenet-consensus-transaction.mapper';

describe('toSafenetConsensusTransaction', () => {
  const chainId = faker.string.numeric({ exclude: ['0'] });

  it('converts the numeric fields to bigint and keeps the others', () => {
    const data = toHex(faker.number.bigInt(), { size: 32 });
    const [value, gasPrice] = [faker.string.numeric(), faker.string.numeric()];
    const [safeTxGas, baseGas, nonce] = [
      faker.number.int(),
      faker.number.int(),
      faker.number.int(),
    ];
    const transaction = multisigTransactionBuilder()
      .with('data', data)
      .with('value', value)
      .with('gasPrice', gasPrice)
      .with('safeTxGas', safeTxGas)
      .with('baseGas', baseGas)
      .with('nonce', nonce)
      .build();

    expect(
      toSafenetConsensusTransaction({
        chainId,
        safe: transaction.safe,
        transaction,
      }),
    ).toEqual({
      chainId: BigInt(chainId),
      safe: transaction.safe,
      to: transaction.to,
      value: BigInt(value),
      data,
      operation: transaction.operation,
      safeTxGas: BigInt(safeTxGas),
      baseGas: BigInt(baseGas),
      gasPrice: BigInt(gasPrice),
      gasToken: transaction.gasToken,
      refundReceiver: transaction.refundReceiver,
      nonce: BigInt(nonce),
    });
  });

  it('fills the fields the Transaction Service leaves null', () => {
    const transaction = multisigTransactionBuilder()
      .with('data', null)
      .with('safeTxGas', null)
      .with('baseGas', null)
      .with('gasPrice', null)
      .with('gasToken', null)
      .with('refundReceiver', null)
      .build();

    expect(
      toSafenetConsensusTransaction({
        chainId,
        safe: transaction.safe,
        transaction,
      }),
    ).toMatchObject({
      data: '0x',
      safeTxGas: 0n,
      baseGas: 0n,
      gasPrice: 0n,
      gasToken: zeroAddress,
      refundReceiver: zeroAddress,
    });
  });
});
