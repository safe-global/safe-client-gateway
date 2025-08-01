import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { Hex } from 'viem';
import { transactionExportRawBuilder } from '@/modules/csv-export/v1/entities/__tests__/transaction-export.builder';
import { TransactionExportSchema } from '@/modules/csv-export/v1/entities/transaction-export.entity';

describe('TransactionExportSchema', () => {
  it('should verify a valid TransactionExport', () => {
    const transactionExport = transactionExportRawBuilder().build();

    const result = TransactionExportSchema.safeParse(transactionExport);
    expect(result.success).toBe(true);
  });

  it('should transform from_ field to from field', () => {
    const from = getAddress(faker.finance.ethereumAddress());
    const transactionExportRaw = transactionExportRawBuilder()
      .with('from_', from)
      .build();

    const result = TransactionExportSchema.safeParse(transactionExportRaw);

    expect(result.success).toBe(true);
    expect(result.data?.from).toBe(from);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.data as any).from_).toBeUndefined();
  });

  it('should checksum addresses', () => {
    const safe = faker.finance.ethereumAddress().toLowerCase();
    const from = faker.finance.ethereumAddress().toLowerCase();
    const to = faker.finance.ethereumAddress().toLowerCase();
    const assetAddress = faker.finance.ethereumAddress().toLowerCase();
    const proposerAddress = faker.finance.ethereumAddress().toLowerCase();
    const executorAddress = faker.finance.ethereumAddress().toLowerCase();
    const contractAddress = faker.finance.ethereumAddress().toLowerCase();

    const transactionExportData = transactionExportRawBuilder()
      .with('safe', safe as `0x${string}`)
      .with('from_', from as `0x${string}`)
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
    expect(errorPaths).toContain('from_');
    expect(errorPaths).toContain('to');
    expect(errorPaths).toContain('amount');
    expect(errorPaths).toContain('assetType');
    expect(errorPaths).toContain('transactionHash');
  });

  it.each([
    'safe',
    'from_',
    'to',
    'assetAddress',
    'proposerAddress',
    'executorAddress',
    'contractAddress',
  ] as const)('should validate %s as a valid address', (field) => {
    const transactionExportData = transactionExportRawBuilder()
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

  it('should validate transactionHash as hex', () => {
    const transactionExport = transactionExportRawBuilder()
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

  it('should validate safeTxHash as hex when provided', () => {
    const transactionExport = transactionExportRawBuilder()
      .with('safeTxHash', 'not-hex' as Hex)
      .build();

    const result = TransactionExportSchema.safeParse(transactionExport);

    expect(!result.success && result.error.issues.length).toBe(1);
    expect(result.error?.issues[0]).toStrictEqual({
      code: 'custom',
      message: 'Invalid "0x" notated hex string',
      path: ['safeTxHash'],
    });
  });

  it('should validate amount as numeric string', () => {
    const transactionExport = transactionExportRawBuilder()
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

  it('should validate assetDecimals as number when provided', () => {
    const transactionExport = transactionExportRawBuilder()
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
    const transactionExportData = transactionExportRawBuilder()
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
    const transactionExportData = transactionExportRawBuilder()
      .with('executedAt', dateString as unknown as Date)
      .build();

    const result = TransactionExportSchema.safeParse(transactionExportData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.executedAt).toEqual(new Date(dateString));
    }
  });

  it('should transform amount using assetDecimals', () => {
    const rawAmount = '1000000000000000000'; // 1 ETH in wei
    const expectedAmount = '1';

    const transactionExport = transactionExportRawBuilder()
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

    const transactionExport = transactionExportRawBuilder()
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

    const transactionExport = transactionExportRawBuilder()
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

    const transactionExport = transactionExportRawBuilder()
      .with('amount', rawAmount)
      .with('assetDecimals', 18)
      .build();

    const result = TransactionExportSchema.safeParse(transactionExport);

    expect(result.success).toBe(true);
    expect(result.data?.amount).toBe(expectedAmount);
  });

  it('should accept null for nullable fields', () => {
    const transactionExport = transactionExportRawBuilder()
      .with('assetAddress', null)
      .with('assetSymbol', null)
      .with('assetDecimals', null)
      .with('proposerAddress', null)
      .with('proposedAt', null)
      .with('executorAddress', null)
      .with('executedAt', null)
      .with('note', null)
      .with('safeTxHash', null)
      .with('contractAddress', null)
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
      expect(result.data.safeTxHash).toBeNull();
      expect(result.data.contractAddress).toBeNull();
    }
  });

  it('should reject invalid date strings for proposedAt', () => {
    const transactionExportData = transactionExportRawBuilder()
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
    const transactionExportData = transactionExportRawBuilder()
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
