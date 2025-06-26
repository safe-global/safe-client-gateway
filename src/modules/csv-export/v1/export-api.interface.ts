import type { Page } from '@/domain/entities/page.entity';
import type { TransactionExport } from '@/modules/csv-export/v1/transaction-export.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export const IExportApi = Symbol('IExportApi');

export interface IExportApi {
  export(args: {
    safeAddress: `0x${string}`;
    executionDateGte: string; //todo Date?
    executionDateLte: string; //todo Date?
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<TransactionExport>>>;
}
