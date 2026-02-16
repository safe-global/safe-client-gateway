import { Inject, Injectable } from '@nestjs/common';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { ChainSchema } from '@/modules/chains/domain/entities/schemas/chain.schema';
import { Chain } from '@/modules/chains/domain/entities/chain.entity';
import { Singleton } from '@/modules/chains/domain/entities/singleton.entity';
import { SingletonsSchema } from '@/modules/chains/domain/entities/schemas/singleton.schema';
import { Page } from '@/domain/entities/page.entity';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { IEtherscanApi } from '@/domain/interfaces/etherscan-api.interface';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import {
  IndexingStatus,
  IndexingStatusSchema,
} from '@/modules/indexing/domain/entities/indexing-status.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { LenientBasePageSchema } from '@/domain/entities/schemas/page.schema.factory';
import {
  GasPriceResponse,
  GasPriceResponseSchema,
} from '@/modules/chains/domain/entities/gas-price-response.entity';

@Injectable()
export class ChainsRepository implements IChainsRepository {
  // According to the limits of the Config Service
  // @see https://github.com/safe-global/safe-config-service/blob/main/src/chains/views.py#L14-L16
  static readonly MAX_LIMIT = 40;

  private readonly maxSequentialPages: number;

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
    @Inject(IEtherscanApi) private readonly etherscanApi: IEtherscanApi,
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.maxSequentialPages = this.configurationService.getOrThrow<number>(
      'safeConfig.chains.maxSequentialPages',
    );
  }

  async getChain(chainId: string): Promise<Chain> {
    const chain = await this.configApi.getChain(chainId);
    return ChainSchema.parse(chain);
  }

  async clearChain(chainId: string): Promise<void> {
    return this.configApi.clearChain(chainId);
  }

  async getChains(limit?: number, offset?: number): Promise<Page<Chain>> {
    const page = await this.configApi
      .getChains({ limit, offset })
      .then(LenientBasePageSchema.parse);
    const valid: Array<Chain> = [];
    const invalid: Array<unknown> = [];
    for (const item of page.results) {
      const result = ChainSchema.safeParse(item);
      if (result.success) {
        valid.push(result.data);
      } else {
        invalid.push(item);
      }
    }
    if (invalid.length > 0) {
      this.loggingService.error({
        message: 'Some chains could not be parsed',
        errors: invalid,
      });
    }
    return { ...page, results: valid };
  }

  async getChainsV2(
    serviceKey: string,
    limit?: number,
    offset?: number,
  ): Promise<Page<Chain>> {
    const page = await this.configApi
      .getChainsV2(serviceKey, { limit, offset })
      .then(LenientBasePageSchema.parse);
    const valid: Array<Chain> = [];
    const invalid: Array<unknown> = [];
    for (const item of page.results) {
      const result = ChainSchema.safeParse(item);
      if (result.success) {
        valid.push(result.data);
      } else {
        invalid.push(item);
      }
    }
    if (invalid.length > 0) {
      this.loggingService.error({
        message: 'Some chains could not be parsed',
        errors: invalid,
      });
    }
    return { ...page, results: valid };
  }

  async getChainV2(serviceKey: string, chainId: string): Promise<Chain> {
    const chain = await this.configApi.getChainV2(serviceKey, chainId);
    return ChainSchema.parse(chain);
  }

  async clearChainV2(chainId: string, serviceKey: string): Promise<void> {
    return this.configApi.clearChainV2(serviceKey, chainId);
  }

  async getAllChains(): Promise<Array<Chain>> {
    const firstPage = await this.getChains(ChainsRepository.MAX_LIMIT, 0);
    const chains: Array<Chain> = [...firstPage.results];

    if (!firstPage.next) {
      return chains;
    }

    const totalCount = firstPage.count ?? firstPage.results.length;
    const totalPages = Math.ceil(totalCount / ChainsRepository.MAX_LIMIT);
    const remainingPageCount = Math.min(
      totalPages - 1,
      this.maxSequentialPages - 1,
    );

    const firstNextUrl = new URL(firstPage.next);
    const firstNextOffset =
      PaginationData.fromLimitAndOffset(firstNextUrl).offset;

    const remainingOffsets: Array<number> = [];
    for (let i = 0; i < remainingPageCount; i++) {
      remainingOffsets.push(firstNextOffset + i * ChainsRepository.MAX_LIMIT);
    }

    const remainingPages = await Promise.all(
      remainingOffsets.map((offset) =>
        this.getChains(ChainsRepository.MAX_LIMIT, offset),
      ),
    );

    for (const page of remainingPages) {
      chains.push(...page.results);
    }

    if (totalPages > this.maxSequentialPages) {
      this.loggingService.error(
        'More chains available despite request limit reached',
      );
    }

    return chains;
  }

  async getSingletons(chainId: string): Promise<Array<Singleton>> {
    const transactionApi = await this.transactionApiManager.getApi(chainId);
    const singletons = await transactionApi.getSingletons();
    return SingletonsSchema.parse(singletons);
  }

  async getIndexingStatus(chainId: string): Promise<IndexingStatus> {
    const transactionApi = await this.transactionApiManager.getApi(chainId);
    const indexingStatus = await transactionApi.getIndexingStatus();
    return IndexingStatusSchema.parse(indexingStatus);
  }

  async isSupportedChain(chainId: string): Promise<boolean> {
    return this.getChain(chainId)
      .then(() => true)
      .catch(() => false);
  }

  async getGasPrice(chainId: string): Promise<GasPriceResponse> {
    const gasPrice = await this.etherscanApi.getGasPrice(chainId);
    return GasPriceResponseSchema.parse(gasPrice);
  }
}
