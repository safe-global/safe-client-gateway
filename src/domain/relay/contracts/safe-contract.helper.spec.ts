import { faker } from '@faker-js/faker';
import { concatHex, encodeFunctionData, getAddress, pad, toHex } from 'viem';
import { SafeContractHelper } from '@/domain/relay/contracts/safe-contract.helper';
import { CALL_OPERATION } from '@/domain/safe/entities/operation.entity';

const ABI_ITEM = {
  inputs: [
    {
      internalType: 'address',
      name: 'to',
      type: 'address',
    },
    {
      internalType: 'uint256',
      name: 'value',
      type: 'uint256',
    },
    {
      internalType: 'bytes',
      name: 'data',
      type: 'bytes',
    },
    {
      internalType: 'enum Enum.Operation',
      name: 'operation',
      type: 'uint8',
    },
    {
      internalType: 'uint256',
      name: 'safeTxGas',
      type: 'uint256',
    },
    {
      internalType: 'uint256',
      name: 'baseGas',
      type: 'uint256',
    },
    {
      internalType: 'uint256',
      name: 'gasPrice',
      type: 'uint256',
    },
    {
      internalType: 'address',
      name: 'gasToken',
      type: 'address',
    },
    {
      internalType: 'address payable',
      name: 'refundReceiver',
      type: 'address',
    },
    {
      internalType: 'bytes',
      name: 'signatures',
      type: 'bytes',
    },
  ],
  name: 'execTransaction',
  outputs: [
    {
      internalType: 'bool',
      name: 'success',
      type: 'bool',
    },
  ],
  stateMutability: 'payable',
  type: 'function',
};

describe('Safe Contract Helper Tests', () => {
  let target: SafeContractHelper;

  beforeEach(() => {
    target = new SafeContractHelper();
  });

  it('decodes an execTransaction correctly', () => {
    const to = getAddress(faker.finance.ethereumAddress());
    const value = faker.number.bigInt();
    const callData = getExecTransactionCallData({ to, value });

    const actual = target.decode(SafeContractHelper.EXEC_TRANSACTION, callData);

    expect(actual).toEqual({ data: '0x00', to: to, value: value });
  });

  it('decoding a non execTransaction call throws', () => {
    const functionSignature = faker.string.hexadecimal({
      length: 8,
    }) as `0x${string}`;
    const arg1 = pad(getAddress(faker.finance.ethereumAddress()));
    const arg2 = pad(getAddress(faker.finance.ethereumAddress()));
    const callData = concatHex([functionSignature, arg1, arg2]);

    expect(() => {
      target.decode(SafeContractHelper.EXEC_TRANSACTION, callData);
    }).toThrow();
  });

  it('isCall returns true for a execTransaction call', () => {
    const callData = getExecTransactionCallData();

    const actual = target.isCall(callData);

    expect(actual).toBe(true);
  });

  it('isCall returns false for a non safe call', () => {
    const functionSignature = faker.string.hexadecimal({
      length: 8,
    }) as `0x${string}`;
    const arg1 = pad(getAddress(faker.finance.ethereumAddress()));
    const arg2 = pad(getAddress(faker.finance.ethereumAddress()));
    const callData = concatHex([functionSignature, arg1, arg2]);

    const actual = target.isCall(callData);

    expect(actual).toBe(false);
  });
});

function getExecTransactionCallData(args?: {
  to?: `0x${string}`;
  value?: bigint;
}): `0x${string}` {
  const to = args?.to ?? getAddress(faker.finance.ethereumAddress());
  const value = args?.value ?? faker.number.bigInt();
  const data = toHex(0);
  const operation = CALL_OPERATION;
  const safeTxGas = faker.number.bigInt();
  const baseGas = faker.number.bigInt();
  const gasPrice = faker.number.bigInt();
  const gasToken = getAddress(faker.finance.ethereumAddress());
  const refundReceiver = getAddress(faker.finance.ethereumAddress());
  const signatures = faker.string.hexadecimal({ length: 64 * 2 });

  return encodeFunctionData({
    abi: [ABI_ITEM],
    functionName: 'execTransaction',
    args: [
      to,
      value,
      data,
      operation,
      safeTxGas,
      baseGas,
      gasPrice,
      gasToken,
      refundReceiver,
      signatures,
    ],
  });
}
