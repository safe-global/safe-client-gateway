// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { ChainApiManager } from '@/datasources/common/chain-api.manager';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { ChainSchema } from '@/modules/chains/domain/entities/schemas/chain.schema';
import type { IExportApiManager } from '@/modules/csv-export/v1/datasources/export-api.manager.interface';
import type { IExportApi } from './export-api.interface';
import { ExportApi } from './export-api.service';

@Injectable()
export class ExportApiManager
  extends ChainApiManager<IExportApi>
  implements IExportApiManager
{
  private readonly useVpcUrl: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    private readonly dataSource: CacheFirstDataSource,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    super();
    this.useVpcUrl = this.configurationService.getOrThrow<boolean>(
      'safeTransaction.useVpcUrl',
    );
  }

  getApi(chainId: string): Promise<IExportApi> {
    return this.getOrCreateApi(chainId);
  }

  protected async createApi(chainId: string): Promise<IExportApi> {
    const chain = await this.configApi
      .getChain(chainId)
      .then(ChainSchema.parse);
    const baseUrl = this.useVpcUrl
      ? chain.vpcTransactionService
      : chain.transactionService;

    return new ExportApi(
      chainId,
      baseUrl,
      this.dataSource,
      this.configurationService,
      this.httpErrorFactory,
    );
  }
}
