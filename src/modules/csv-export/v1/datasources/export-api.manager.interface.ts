import { Module } from '@nestjs/common';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { TxAuthNetworkModule } from '@/datasources/network/tx-auth.network.module';
import type { IApiManager } from '@/domain/interfaces/api.manager.interface';
import type { IExportApi } from '@/modules/csv-export/v1/datasources/export-api.interface';
import { ExportApiManager } from '@/modules/csv-export/v1/datasources/export-api.manager';

export const IExportApiManager = Symbol('IExportApiManager');

export interface IExportApiManager extends IApiManager<IExportApi> {}

@Module({
  imports: [ConfigApiModule, TxAuthNetworkModule],
  providers: [{ provide: IExportApiManager, useClass: ExportApiManager }],

  exports: [IExportApiManager],
})
export class ExportApiManagerModule {}
