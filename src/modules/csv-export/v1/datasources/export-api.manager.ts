import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { ChainSchema } from '@/domain/chains/entities/schemas/chain.schema';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import type { IExportApi } from './export-api.interface';
import { ExportApi } from './export-api.service';
import { IExportApiManager } from '@/modules/csv-export/v1/datasources/export-api.manager.interface';

@Injectable()
export class ExportApiManager implements IExportApiManager {
  private readonly exportApiMap: Record<string, ExportApi> = {};
  private readonly useVpcUrl: boolean;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    private readonly dataSource: CacheFirstDataSource,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.useVpcUrl = this.configurationService.getOrThrow<boolean>(
      'safeTransaction.useVpcUrl',
    );
  }

  async getApi(chainId: string): Promise<IExportApi> {
    const api = this.exportApiMap[chainId];
    if (api) return api;

    const chain = await this.configApi
      .getChain(chainId)
      .then(ChainSchema.parse);
    const baseUrl = this.useVpcUrl
      ? chain.vpcTransactionService
      : chain.transactionService;
    this.exportApiMap[chainId] = new ExportApi(
      chainId,
      baseUrl,
      this.dataSource,
      this.configurationService,
      this.httpErrorFactory,
    );
    return this.exportApiMap[chainId];
  }

  destroyApi(chainId: string): void {
    if (this.exportApiMap[chainId]) {
      delete this.exportApiMap[chainId];
    }
  }
}
