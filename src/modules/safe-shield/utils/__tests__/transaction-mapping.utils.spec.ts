import { mapDecodedTransactions } from '../transaction-mapping.utils';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import type { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import { dataDecodedBuilder } from '@/domain/data-decoder/v2/entities/__tests__/data-decoded.builder';

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
      operation: 0,
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
          value: faker.string.hexadecimal({ length: 32 }),
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
          value: faker.string.hexadecimal({ length: 32 }),
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
          value: faker.string.hexadecimal({ length: 32 }),
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

    // Should return empty array since there are no inner transactions
    expect(result).toHaveLength(0);
  });
});
