// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { IExportApiManager } from '@/modules/csv-export/v1/datasources/export-api.manager.interface';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { ExportApiManager } from '@/modules/csv-export/v1/datasources/export-api.manager';
import { TxAuthNetworkModule } from '@/datasources/network/tx-auth.network.module';

@Module({
  imports: [ConfigApiModule, TxAuthNetworkModule],
  providers: [{ provide: IExportApiManager, useClass: ExportApiManager }],

  exports: [IExportApiManager],
})
export class ExportApiManagerModule {}
