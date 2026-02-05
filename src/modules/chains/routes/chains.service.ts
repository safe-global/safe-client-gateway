import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { IBackboneRepository } from '@/modules/backbone/domain/backbone.repository.interface';
import { Backbone } from '@/modules/backbone/domain/entities/backbone.entity';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { MasterCopy } from '@/modules/chains/routes/entities/master-copy.entity';
import { Page } from '@/domain/entities/page.entity';
import { AboutChain } from '@/modules/chains/routes/entities/about-chain.entity';
import { Chain } from '@/modules/chains/routes/entities/chain.entity';
import { GasPriceResponse } from '@/modules/chains/routes/entities/gas-price-response.entity';
import {
  PaginationData,
  cursorUrlFromLimitAndOffset,
} from '@/routes/common/pagination/pagination.data';
import { IndexingStatus } from '@/modules/chains/routes/entities/indexing-status.entity';

@Injectable()
export class ChainsService {
  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(IBackboneRepository)
    private readonly backboneRepository: IBackboneRepository,
    private readonly dataSource: CacheFirstDataSource,
  ) {}

  async getChains(
    routeUrl: Readonly<URL>,
    paginationData: PaginationData,
  ): Promise<Page<Chain>> {
    const result = await this.chainsRepository.getChains(
      paginationData.limit,
      paginationData.offset,
    );

    const nextURL = cursorUrlFromLimitAndOffset(routeUrl, result.next);
    const previousURL = cursorUrlFromLimitAndOffset(routeUrl, result.previous);

    const chains = result.results.map((chain) => {
      return new Chain(chain);
    });

    return {
      count: result.count,
      next: nextURL?.toString() ?? null,
      previous: previousURL?.toString() ?? null,
      results: chains,
    };
  }

  async getChain(chainId: string): Promise<Chain> {
    const result = await this.chainsRepository.getChain(chainId);
    return new Chain(result);
  }

  async getAboutChain(chainId: string): Promise<AboutChain> {
    const chain = await this.chainsRepository.getChain(chainId);

    return new AboutChain(
      chain.transactionService,
      this.configurationService.getOrThrow<string>('about.name'),
      this.configurationService.getOrThrow<string>('about.version'),
      this.configurationService.getOrThrow<string>('about.buildNumber'),
    );
  }

  async getBackbone(chainId: string): Promise<Backbone> {
    return this.backboneRepository.getBackbone(chainId);
  }

  async getMasterCopies(chainId: string): Promise<Array<MasterCopy>> {
    const result = await this.chainsRepository.getSingletons(chainId);

    return result.map((singleton) => ({
      address: singleton.address,
      version: singleton.version,
    }));
  }

  async getIndexingStatus(chainId: string): Promise<IndexingStatus> {
    const indexingStatus =
      await this.chainsRepository.getIndexingStatus(chainId);

    const lastSync = Math.min(
      indexingStatus.erc20BlockTimestamp.getTime(),
      indexingStatus.masterCopiesBlockTimestamp.getTime(),
    );

    return new IndexingStatus({
      currentBlockNumber: indexingStatus.currentBlockNumber,
      currentBlockTimestamp: indexingStatus.currentBlockTimestamp,
      erc20BlockNumber: indexingStatus.erc20BlockNumber,
      erc20BlockTimestamp: indexingStatus.erc20BlockTimestamp,
      erc20Synced: indexingStatus.erc20Synced,
      masterCopiesBlockNumber: indexingStatus.masterCopiesBlockNumber,
      masterCopiesBlockTimestamp: indexingStatus.masterCopiesBlockTimestamp,
      masterCopiesSynced: indexingStatus.masterCopiesSynced,
      synced: indexingStatus.synced,
      lastSync,
    });
  }

  async getGasPrice(chainId: string): Promise<GasPriceResponse> {
    const chain = await this.chainsRepository.getChain(chainId);
    const oracleConfig = chain.gasPrice.find((gp) => gp.type === 'oracle');

    if (!oracleConfig || oracleConfig.type !== 'oracle') {
      throw new NotFoundException(`No gas price oracle for chain ${chainId}`);
    }

    const url = this.buildGasPriceUrl(oracleConfig.uri);
    const cacheDir = CacheRouter.getGasPriceCacheDir(chainId);
    const cacheTtl = this.configurationService.getOrThrow<number>(
      'gasPrice.cacheTtlSeconds',
    );

    const response = await this.dataSource.get<GasPriceResponse>({
      cacheDir,
      url,
      expireTimeSeconds: cacheTtl,
      notFoundExpireTimeSeconds: cacheTtl,
    });

    // Return the raw oracle response in Etherscan API format
    // The response is wrapped in Raw<T> type, cast it back to the actual type
    return response as unknown as GasPriceResponse;
  }

  private buildGasPriceUrl(baseUri: string): string {
    const url = new URL(baseUri);
    // Remove any existing apikey from config-service URI
    url.searchParams.delete('apikey');
    url.searchParams.delete('apiKey');

    const apiKey = this.configurationService.get<string>(
      'gasPrice.etherscanApiKey',
    );
    if (apiKey) {
      url.searchParams.set('apikey', apiKey);
    }
    return url.toString();
  }
}
