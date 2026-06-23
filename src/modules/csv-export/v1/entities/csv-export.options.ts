// SPDX-License-Identifier: FSL-1.1-MIT
import type { CastingContext } from 'csv-stringify';
import type { CsvOptions } from '@/modules/csv-export/csv-utils/csv.service';
import { escapeCsvFormula } from '@/modules/csv-export/csv-utils/escape-csv-formula';

// Numeric columns: not user-controlled, may start with '-', so not escaped.
const NUMERIC_COLUMNS: ReadonlySet<string | number> = new Set([
  'amount',
  'payment',
]);

// Escape non-numeric columns for any cell type (casts dispatch by type).
const castCell = (value: unknown, context: CastingContext): string => {
  if (context.column != null && NUMERIC_COLUMNS.has(context.column)) {
    return String(value);
  }
  return escapeCsvFormula(value);
};

export const CSV_OPTIONS: CsvOptions = {
  header: true,
  columns: [
    { key: 'nonce', header: 'Nonce' },
    { key: 'safe', header: 'Safe Address' },
    { key: 'from', header: 'From Address' },
    { key: 'to', header: 'To Address' },
    { key: 'transactionHash', header: 'Transaction Hash' },
    { key: 'contractAddress', header: 'Contract Address' },
    { key: 'amount', header: 'Amount' },
    { key: 'assetType', header: 'Asset Type' },
    { key: 'assetSymbol', header: 'Asset Symbol' },
    { key: 'proposedAt', header: 'Created at' },
    { key: 'executedAt', header: 'Executed at' },
    { key: 'proposerAddress', header: 'Proposer Address' },
    { key: 'executorAddress', header: 'Executor Address' },
    { key: 'note', header: 'Note' },
    { key: 'payment', header: 'Amount Gas' },
    { key: 'gasTokenSymbol', header: 'Gas token' },
  ],
  cast: {
    date: (value: Date): string => value.toISOString(),
    string: castCell,
    number: castCell,
    boolean: castCell,
    bigint: castCell,
  },
};
