import type { Page } from '@/domain/entities/page.entity';
import type { TransactionExport } from '@/modules/csv-export/v1/entities/transaction-export.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import type { Address } from 'viem';

export const IExportApi = Symbol('IExportApi');

export interface IExportApi {
  export(args: {
    safeAddress: Address;
    executionDateGte?: string;
    executionDateLte?: string;
    limit?: number;
    offset?: number;
  }): Promise<Raw<Page<TransactionExport>>>;
}
