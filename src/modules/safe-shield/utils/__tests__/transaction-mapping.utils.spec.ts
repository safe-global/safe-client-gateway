import {
  mapDecodedTransactions,
  isMultiSend,
  isExecTransaction,
  mapMultiSendTransactions,
} from '../transaction-mapping.utils';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import type { DataDecoded } from '@/modules/data-decoder/routes/entities/data-decoded.entity';
import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import { dataDecodedBuilder } from '@/modules/data-decoder/domain/v2/entities/__tests__/data-decoded.builder';

describe('mapDecodedTransactions', () => {
  const mockRecipientAddress = getAddress(faker.finance.ethereumAddress());
  const mockData = faker.string.hexadecimal({ length: 128 }) as Hex;

  const mockDataDecoded: DataDecoded = dataDecodedBuilder()
    .with('method', 'transfer')
    .with('parameters', [
      {
        name: 'to',
        type: 'address',
        value: mockRecipientAddress,
        valueDecoded: null,
      },
      {
        name: 'value',
        type: 'uint256',
        value: faker.number.bigInt().toString(),
        valueDecoded: null,
      },
    ])
    .with('accuracy', 'FULL_MATCH')
    .build();

  it('should handle execTransaction by extracting inner transaction', () => {
    const expectedValue = faker.number.bigInt().toString();
    const expectedOperation = '1';
    const execTransactionDecoded: DataDecoded = dataDecodedBuilder()
      .with('method', 'execTransaction')
      .with('parameters', [
        {
          name: 'to',
          type: 'address',
          value: mockRecipientAddress,
          valueDecoded: null,
        },
        {
          name: 'value',
          type: 'uint256',
          value: expectedValue,
          valueDecoded: null,
        },
        {
          name: 'data',
          type: 'bytes',
          value: mockData,
          valueDecoded: mockDataDecoded,
        },
        {
          name: 'operation',
          type: 'uint256',
          value: expectedOperation,
          valueDecoded: null,
        },
      ])
      .with('accuracy', 'FULL_MATCH')
      .build();

    const transaction: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: '0',
      data: faker.string.hexadecimal({ length: 32 }) as Hex,
      dataDecoded: execTransactionDecoded,
    };

    const result = mapDecodedTransactions(transaction);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      operation: Number(expectedOperation),
      to: mockRecipientAddress,
      value: expectedValue,
      data: mockData,
      dataDecoded: mockDataDecoded,
    });
  });

  it('should handle multiSend by extracting all inner transactions', () => {
    const expectedValue = faker.number.bigInt().toString();
    const secondRecipient = getAddress(faker.finance.ethereumAddress());
    const multiSendDecoded: DataDecoded = dataDecodedBuilder()
      .with('method', 'multiSend')
      .with('parameters', [
        {
          name: 'transactions',
          type: 'bytes',
          value: faker.string.hexadecimal({ length: 32 }) as Hex,
          valueDecoded: [
            {
              operation: 0,
              to: mockRecipientAddress,
              value: expectedValue,
              data: mockData,
              dataDecoded: mockDataDecoded,
            },
            {
              operation: 0,
              to: secondRecipient,
              value: '0',
              data: '0x',
              dataDecoded: null,
            },
          ],
        },
      ])
      .with('accuracy', 'FULL_MATCH')
      .build();

    const transaction: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: '0',
      data: `0x8d80ff0a${faker.string.hexadecimal({ length: 128, casing: 'lower', prefix: '' })}` as Hex,
      dataDecoded: multiSendDecoded,
    };

    const result = mapDecodedTransactions(transaction);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      operation: 0,
      to: mockRecipientAddress,
      value: expectedValue,
      data: mockData,
      dataDecoded: mockDataDecoded,
    });
    expect(result[1]).toEqual({
      operation: 0,
      to: secondRecipient,
      value: '0',
      data: '0x',
      dataDecoded: null,
    });
  });

  it('should return transaction as-is for non-multiSend, non-execTransaction', () => {
    const transaction: DecodedTransactionData = {
      operation: 0,
      to: mockRecipientAddress,
      value: faker.number.bigInt().toString(),
      data: mockData,
      dataDecoded: mockDataDecoded,
    };

    const result = mapDecodedTransactions(transaction);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(transaction);
  });

  it('should handle transaction with null dataDecoded', () => {
    const transaction: DecodedTransactionData = {
      operation: 0,
      to: mockRecipientAddress,
      value: faker.number.bigInt().toString(),
      data: '0x',
      dataDecoded: null,
    };

    const result = mapDecodedTransactions(transaction);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(transaction);
  });

  it('should handle execTransaction with missing parameters', () => {
    const execTransactionDecoded: DataDecoded = dataDecodedBuilder()
      .with('method', 'execTransaction')
      .with('parameters', []) // Missing parameters
      .with('accuracy', 'FULL_MATCH')
      .build();

    const transaction: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: '0',
      data: faker.string.hexadecimal({ length: 32 }) as Hex,
      dataDecoded: execTransactionDecoded,
    };

    // This should throw because it tries to access parameters[0], parameters[1], parameters[2]
    expect(() => mapDecodedTransactions(transaction)).toThrow();
  });

  it('should handle multiSend with missing valueDecoded', () => {
    const multiSendDecoded: DataDecoded = dataDecodedBuilder()
      .with('method', 'multiSend')
      .with('parameters', [
        {
          name: 'transactions',
          type: 'bytes',
          value: faker.string.hexadecimal({ length: 32 }) as Hex,
          valueDecoded: null,
        },
      ])
      .with('accuracy', 'FULL_MATCH')
      .build();

    const transaction: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: '0',
      data: `0x8d80ff0a${faker.string.hexadecimal({ length: 128, casing: 'lower', prefix: '' })}` as Hex,
      dataDecoded: multiSendDecoded,
    };

    const result = mapDecodedTransactions(transaction);

    // Should return transaction as-is since valueDecoded is invalid
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(transaction);
  });

  it('should handle multiSend with empty array valueDecoded', () => {
    const multiSendDecoded: DataDecoded = dataDecodedBuilder()
      .with('method', 'multiSend')
      .with('parameters', [
        {
          name: 'transactions',
          type: 'bytes',
          value: faker.string.hexadecimal({ length: 32 }) as Hex,
          valueDecoded: [], // Empty array - valid but contains no transactions
        },
      ])
      .with('accuracy', 'FULL_MATCH')
      .build();

    const transaction: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: '0',
      data: `0x8d80ff0a${faker.string.hexadecimal({ length: 128, casing: 'lower', prefix: '' })}` as Hex,
      dataDecoded: multiSendDecoded,
    };

    const result = mapDecodedTransactions(transaction);

    // Should return the transaction itself since there are no inner transactions to process
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(transaction);
  });
});

describe('isMultiSend', () => {
  it('should return true for multiSend transaction with array valueDecoded', () => {
    const dataDecoded: DataDecoded = dataDecodedBuilder()
      .with('method', 'multiSend')
      .with('parameters', [
        {
          name: 'transactions',
          type: 'bytes',
          value: '0x123',
          valueDecoded: [
            {
              operation: 0,
              to: getAddress(faker.finance.ethereumAddress()),
              value: '0',
              data: '0x',
              dataDecoded: null,
            },
          ],
        },
      ])
      .build();

    const tx: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: BigInt(0),
      data: '0x123' as Hex,
      dataDecoded,
    };

    expect(isMultiSend(tx)).toBe(true);
  });

  it('should return false for multiSend transaction without array valueDecoded', () => {
    const dataDecoded: DataDecoded = dataDecodedBuilder()
      .with('method', 'multiSend')
      .with('parameters', [
        {
          name: 'transactions',
          type: 'bytes',
          value: '0x123',
          valueDecoded: null,
        },
      ])
      .build();

    const tx: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: BigInt(0),
      data: '0x123' as Hex,
      dataDecoded,
    };

    expect(isMultiSend(tx)).toBe(false);
  });

  it('should return false for non-multiSend transaction', () => {
    const dataDecoded: DataDecoded = dataDecodedBuilder()
      .with('method', 'transfer')
      .with('parameters', [
        {
          name: 'to',
          type: 'address',
          value: getAddress(faker.finance.ethereumAddress()),
          valueDecoded: null,
        },
      ])
      .build();

    const tx: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: BigInt(0),
      data: '0x123' as Hex,
      dataDecoded,
    };

    expect(isMultiSend(tx)).toBe(false);
  });

  it('should return false for null dataDecoded', () => {
    const tx: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: BigInt(0),
      data: '0x123' as Hex,
      dataDecoded: null,
    };

    expect(isMultiSend(tx)).toBe(false);
  });

  it('should return false for dataDecoded without method', () => {
    const dataDecoded = {
      method: undefined,
      accuracy: 'FULL_MATCH',
      parameters: [
        {
          name: 'transactions',
          type: 'bytes',
          value: '0x123',
          valueDecoded: [],
        },
      ],
    } as unknown as DataDecoded;

    const tx: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: BigInt(0),
      data: '0x123' as Hex,
      dataDecoded,
    };

    expect(isMultiSend(tx)).toBe(false);
  });

  it('should return false for multiSend without parameters', () => {
    const dataDecoded: DataDecoded = dataDecodedBuilder()
      .with('method', 'multiSend')
      .with('parameters', null)
      .build();

    const tx: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: BigInt(0),
      data: '0x123' as Hex,
      dataDecoded,
    };

    expect(isMultiSend(tx)).toBe(false);
  });
});

describe('mapMultiSendTransactions', () => {
  const mockRecipientAddress = getAddress(faker.finance.ethereumAddress());
  const mockData = faker.string.hexadecimal({ length: 128 }) as Hex;
  const mockDataDecoded: DataDecoded = dataDecodedBuilder()
    .with('method', 'transfer')
    .with('parameters', [
      {
        name: 'to',
        type: 'address',
        value: mockRecipientAddress,
        valueDecoded: null,
      },
      {
        name: 'value',
        type: 'uint256',
        value: faker.number.bigInt().toString(),
        valueDecoded: null,
      },
    ])
    .with('accuracy', 'FULL_MATCH')
    .build();

  it('should extract inner transactions from multiSend', () => {
    const expectedValue = faker.number.bigInt().toString();
    const secondRecipient = getAddress(faker.finance.ethereumAddress());
    const multiSendDecoded: DataDecoded = dataDecodedBuilder()
      .with('method', 'multiSend')
      .with('parameters', [
        {
          name: 'transactions',
          type: 'bytes',
          value: faker.string.hexadecimal({ length: 32 }) as Hex,
          valueDecoded: [
            {
              operation: 0,
              to: mockRecipientAddress,
              value: expectedValue,
              data: mockData,
              dataDecoded: mockDataDecoded,
            },
            {
              operation: 1,
              to: secondRecipient,
              value: '0',
              data: '0x',
              dataDecoded: null,
            },
          ],
        },
      ])
      .with('accuracy', 'FULL_MATCH')
      .build();

    const transaction: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: '0',
      data: `0x8d80ff0a${faker.string.hexadecimal({ length: 128, casing: 'lower', prefix: '' })}` as Hex,
      dataDecoded: multiSendDecoded,
    };

    const result = mapMultiSendTransactions(transaction);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      operation: 0,
      to: mockRecipientAddress,
      value: expectedValue,
      data: mockData,
      dataDecoded: mockDataDecoded,
    });
    expect(result[1]).toEqual({
      operation: 1,
      to: secondRecipient,
      value: '0',
      data: '0x',
      dataDecoded: null,
    });
  });

  it('should return transaction itself for non-multiSend', () => {
    const transaction: DecodedTransactionData = {
      operation: 0,
      to: mockRecipientAddress,
      value: faker.number.bigInt().toString(),
      data: mockData,
      dataDecoded: mockDataDecoded,
    };

    const result = mapMultiSendTransactions(transaction);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(transaction);
  });

  it('should return transaction itself for multiSend with empty valueDecoded', () => {
    const multiSendDecoded: DataDecoded = dataDecodedBuilder()
      .with('method', 'multiSend')
      .with('parameters', [
        {
          name: 'transactions',
          type: 'bytes',
          value: faker.string.hexadecimal({ length: 32 }) as Hex,
          valueDecoded: [],
        },
      ])
      .with('accuracy', 'FULL_MATCH')
      .build();

    const transaction: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: '0',
      data: `0x8d80ff0a${faker.string.hexadecimal({ length: 128, casing: 'lower', prefix: '' })}` as Hex,
      dataDecoded: multiSendDecoded,
    };

    const result = mapMultiSendTransactions(transaction);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(transaction);
  });

  it('should return transaction itself for multiSend with null valueDecoded', () => {
    const multiSendDecoded: DataDecoded = dataDecodedBuilder()
      .with('method', 'multiSend')
      .with('parameters', [
        {
          name: 'transactions',
          type: 'bytes',
          value: faker.string.hexadecimal({ length: 32 }) as Hex,
          valueDecoded: null,
        },
      ])
      .with('accuracy', 'FULL_MATCH')
      .build();

    const transaction: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: '0',
      data: `0x8d80ff0a${faker.string.hexadecimal({ length: 128, casing: 'lower', prefix: '' })}` as Hex,
      dataDecoded: multiSendDecoded,
    };

    const result = mapMultiSendTransactions(transaction);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(transaction);
  });
});

describe('isExecTransaction', () => {
  it('should return true for execTransaction', () => {
    const dataDecoded: DataDecoded = dataDecodedBuilder()
      .with('method', 'execTransaction')
      .with('parameters', [
        {
          name: 'to',
          type: 'address',
          value: getAddress(faker.finance.ethereumAddress()),
          valueDecoded: null,
        },
        {
          name: 'value',
          type: 'uint256',
          value: '0',
          valueDecoded: null,
        },
        {
          name: 'data',
          type: 'bytes',
          value: '0x123',
          valueDecoded: null,
        },
        {
          name: 'operation',
          type: 'uint256',
          value: '0',
          valueDecoded: null,
        },
      ])
      .build();

    const tx: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: BigInt(0),
      data: '0x123' as Hex,
      dataDecoded,
    };

    expect(isExecTransaction(tx)).toBe(true);
  });

  it('should return false for non-execTransaction', () => {
    const dataDecoded: DataDecoded = dataDecodedBuilder()
      .with('method', 'transfer')
      .with('parameters', [
        {
          name: 'to',
          type: 'address',
          value: getAddress(faker.finance.ethereumAddress()),
          valueDecoded: null,
        },
      ])
      .build();

    const tx: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: BigInt(0),
      data: '0x123' as Hex,
      dataDecoded,
    };

    expect(isExecTransaction(tx)).toBe(false);
  });

  it('should return false for null dataDecoded', () => {
    const tx: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: BigInt(0),
      data: '0x123' as Hex,
      dataDecoded: null,
    };

    expect(isExecTransaction(tx)).toBe(false);
  });

  it('should return false for dataDecoded without method', () => {
    const dataDecoded = {
      method: undefined,
      accuracy: 'FULL_MATCH',
      parameters: [],
    } as unknown as DataDecoded;

    const tx: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: BigInt(0),
      data: '0x123' as Hex,
      dataDecoded,
    };

    expect(isExecTransaction(tx)).toBe(false);
  });

  it('should return false for execTransaction without parameters array', () => {
    const dataDecoded = {
      method: 'execTransaction',
      accuracy: 'FULL_MATCH',
      parameters: null,
    } as unknown as DataDecoded;

    const tx: DecodedTransactionData = {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: BigInt(0),
      data: '0x123' as Hex,
      dataDecoded,
    };

    expect(isExecTransaction(tx)).toBe(false);
  });
});
