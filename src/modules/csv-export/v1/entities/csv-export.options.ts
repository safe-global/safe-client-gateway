import type { CsvOptions } from '@/modules/csv-export/csv-utils/csv.service';

export const CSV_OPTIONS: CsvOptions = {
  header: true,
  columns: [
    { key: 'safe', header: 'Safe Address' },
    { key: 'from', header: 'From Address' },
    { key: 'to', header: 'To Address' },
    { key: 'transactionHash', header: 'Transaction Hash' },
    { key: 'contractAddress', header: 'Contract Address' },
    { key: 'amount', header: 'Amount' },
    { key: 'assetType', header: 'Asset' },
    { key: 'proposedAt', header: 'Created at' },
    { key: 'executedAt', header: 'Executed at' },
    { key: 'proposerAddress', header: 'Proposer Address' },
    { key: 'executorAddress', header: 'Executor Address' },
    { key: 'note', header: 'Note' },
  ],
  cast: {
    date: (value: Date): string => value.toISOString(),
  },
};
