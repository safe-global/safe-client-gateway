import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { Hex } from 'viem';
import { transactionExportBuilder } from '@/modules/csv-export/v1/entities/__tests__/transaction-export.builder';
import { TransactionExportSchema } from '@/modules/csv-export/v1/entities/transaction-export.entity';

describe('TransactionExportSchema', () => {
  it('should verify a valid TransactionExport', () => {
    const transactionExport = transactionExportBuilder().build();

    const result = TransactionExportSchema.safeParse(transactionExport);
    expect(result.success).toBe(true);
  });

  it('should checksum addresses', () => {
    const safe = faker.finance.ethereumAddress().toLowerCase();
    const from = faker.finance.ethereumAddress().toLowerCase();
    const to = faker.finance.ethereumAddress().toLowerCase();
    const assetAddress = faker.finance.ethereumAddress().toLowerCase();
    const proposerAddress = faker.finance.ethereumAddress().toLowerCase();
    const executorAddress = faker.finance.ethereumAddress().toLowerCase();
    const contractAddress = faker.finance.ethereumAddress().toLowerCase();

    const transactionExportData = transactionExportBuilder()
      .with('safe', safe as `0x${string}`)
      .with('from', from as `0x${string}`)
      .with('to', to as `0x${string}`)
      .with('assetAddress', assetAddress as `0x${string}`)
      .with('proposerAddress', proposerAddress as `0x${string}`)
      .with('executorAddress', executorAddress as `0x${string}`)
      .with('contractAddress', contractAddress as `0x${string}`)
      .build();

    const result = TransactionExportSchema.safeParse(transactionExportData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.safe).toBe(getAddress(safe));
      expect(result.data.from).toBe(getAddress(from));
      expect(result.data.to).toBe(getAddress(to));
      expect(result.data.assetAddress).toBe(getAddress(assetAddress));
      expect(result.data.proposerAddress).toBe(getAddress(proposerAddress));
      expect(result.data.executorAddress).toBe(getAddress(executorAddress));
      expect(result.data.contractAddress).toBe(getAddress(contractAddress));
    }
  });

  it('should validate required fields', () => {
    const result = TransactionExportSchema.safeParse({});

    expect(result.success).toBe(false);
    const errorPaths = result.error?.issues.map((issue) => issue.path[0]);
    expect(errorPaths).toContain('safe');
    expect(errorPaths).toContain('from');
    expect(errorPaths).toContain('to');
    expect(errorPaths).toContain('amount');
    expect(errorPaths).toContain('assetType');
    expect(errorPaths).toContain('transactionHash');
  });

  it.each([
    'safe',
    'from',
    'to',
    'assetAddress',
    'proposerAddress',
    'executorAddress',
    'contractAddress',
  ] as const)('should validate %s as a valid address', (field) => {
    const transactionExportData = transactionExportBuilder()
      .with(field, '0x123' as `0x${string}`)
      .build();

    const result = TransactionExportSchema.safeParse(transactionExportData);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(result.error?.issues[0]).toStrictEqual({
      code: 'custom',
      message: 'Invalid address',
      path: [field],
    });
  });

  it('should accept null for nullable fields', () => {
    const transactionExport = transactionExportBuilder()
      .with('assetAddress', null)
      .with('assetSymbol', null)
      .with('assetDecimals', null)
      .with('proposerAddress', null)
      .with('proposedAt', null)
      .with('executorAddress', null)
      .with('executedAt', null)
      .with('note', null)
      .with('contractAddress', null)
      .with('nonce', null)
      .build();

    const result = TransactionExportSchema.safeParse(transactionExport);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assetAddress).toBeNull();
      expect(result.data.assetSymbol).toBeNull();
      expect(result.data.assetDecimals).toBeNull();
      expect(result.data.proposerAddress).toBeNull();
      expect(result.data.proposedAt).toBeNull();
      expect(result.data.executorAddress).toBeNull();
      expect(result.data.executedAt).toBeNull();
      expect(result.data.note).toBeNull();
      expect(result.data.contractAddress).toBeNull();
      expect(result.data.nonce).toBeNull();
    }
  });

  it('should validate transactionHash as hex', () => {
    const transactionExport = transactionExportBuilder()
      .with('transactionHash', 'not-hex' as Hex)
      .build();

    const result = TransactionExportSchema.safeParse(transactionExport);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(result.error?.issues[0]).toStrictEqual({
      code: 'custom',
      message: 'Invalid "0x" notated hex string',
      path: ['transactionHash'],
    });
  });

  it('should validate amount as numeric string', () => {
    const transactionExport = transactionExportBuilder()
      .with('amount', 'not-numeric')
      .build();

    const result = TransactionExportSchema.safeParse(transactionExport);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(result.error?.issues[0]).toStrictEqual({
      code: 'custom',
      message: 'Invalid base-10 numeric string',
      path: ['amount'],
    });
  });

  it('should transform amount using assetDecimals', () => {
    const rawAmount = '1000000000000000000'; // 1 ETH in wei
    const expectedAmount = '1';

    const transactionExport = transactionExportBuilder()
      .with('amount', rawAmount)
      .with('assetDecimals', 18)
      .build();

    const result = TransactionExportSchema.safeParse(transactionExport);

    expect(result.success).toBe(true);
    expect(result.data?.amount).toBe(expectedAmount);
    expect(typeof result.data?.amount).toBe('string');
  });

  it('should not transform amount when assetDecimals is null (defaults to 0)', () => {
    const rawAmount = '100';
    const expectedAmount = '100';

    const transactionExport = transactionExportBuilder()
      .with('amount', rawAmount)
      .with('assetDecimals', null)
      .build();

    const result = TransactionExportSchema.safeParse(transactionExport);

    expect(result.success).toBe(true);
    expect(result.data?.amount).toBe(expectedAmount);
  });

  it('should handle small amounts with high decimals', () => {
    const rawAmount = '1'; // smallest unit
    const assetDecimals = 18;
    const expectedAmount = '0.000000000000000001';

    const transactionExport = transactionExportBuilder()
      .with('amount', rawAmount)
      .with('assetDecimals', assetDecimals)
      .build();

    const result = TransactionExportSchema.safeParse(transactionExport);

    expect(result.success).toBe(true);
    expect(result.data?.amount).toBe(expectedAmount);
  });

  it('should handle large amounts correctly', () => {
    const rawAmount = '123456789012345678901'; // Large amount in wei
    const expectedAmount = '123.456789012345678901';

    const transactionExport = transactionExportBuilder()
      .with('amount', rawAmount)
      .with('assetDecimals', 18)
      .build();

    const result = TransactionExportSchema.safeParse(transactionExport);

    expect(result.success).toBe(true);
    expect(result.data?.amount).toBe(expectedAmount);
  });

  it('should validate assetDecimals as number when provided', () => {
    const transactionExport = transactionExportBuilder()
      .with('assetDecimals', 'not-number' as unknown as number)
      .build();

    const result = TransactionExportSchema.safeParse(transactionExport);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(result.error?.issues[0]).toStrictEqual({
      code: 'invalid_type',
      expected: 'number',
      message: 'Expected number, received string',
      path: ['assetDecimals'],
      received: 'string',
    });
  });

  it('should coerce proposedAt to date', () => {
    const dateString = '2023-01-01T00:00:00Z';
    const transactionExportData = transactionExportBuilder()
      .with('proposedAt', dateString as unknown as Date)
      .build();

    const result = TransactionExportSchema.safeParse(transactionExportData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.proposedAt).toEqual(new Date(dateString));
    }
  });

  it('should coerce executedAt to date', () => {
    const dateString = '2023-01-01T00:00:00Z';
    const transactionExportData = transactionExportBuilder()
      .with('executedAt', dateString as unknown as Date)
      .build();

    const result = TransactionExportSchema.safeParse(transactionExportData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.executedAt).toEqual(new Date(dateString));
    }
  });

  it('should reject invalid date strings for proposedAt', () => {
    const transactionExportData = transactionExportBuilder()
      .with('proposedAt', 'invalid-date' as unknown as Date)
      .build();

    const result = TransactionExportSchema.safeParse(transactionExportData);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(result.error?.issues[0]).toStrictEqual({
      code: 'invalid_date',
      message: 'Invalid date',
      path: ['proposedAt'],
    });
  });

  it('should reject invalid date strings for executedAt', () => {
    const transactionExportData = transactionExportBuilder()
      .with('executedAt', 'invalid-date' as unknown as Date)
      .build();

    const result = TransactionExportSchema.safeParse(transactionExportData);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(result.error?.issues[0]).toStrictEqual({
      code: 'invalid_date',
      message: 'Invalid date',
      path: ['executedAt'],
    });
  });
});
