import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IBackboneRepository } from '@/domain/backbone/backbone.repository.interface';
import { Backbone } from '@/domain/backbone/entities/backbone.entity';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { MasterCopy } from '@/routes/chains/entities/master-copy.entity';
import { Page } from '@/domain/entities/page.entity';
import { AboutChain } from '@/routes/chains/entities/about-chain.entity';
import { Chain } from '@/routes/chains/entities/chain.entity';
import {
  PaginationData,
  cursorUrlFromLimitAndOffset,
} from '@/routes/common/pagination/pagination.data';

@Injectable()
export class ChainsService {
  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(IBackboneRepository)
    private readonly backboneRepository: IBackboneRepository,
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
      return new Chain({
        chainId: chain.chainId,
        chainName: chain.chainName,
        description: chain.description,
        l2: chain.l2,
        nativeCurrency: chain.nativeCurrency,
        transactionService: chain.transactionService,
        blockExplorerUriTemplate: chain.blockExplorerUriTemplate,
        disabledWallets: chain.disabledWallets,
        features: chain.features,
        gasPrice: chain.gasPrice,
        publicRpcUri: chain.publicRpcUri,
        rpcUri: chain.rpcUri,
        safeAppsRpcUri: chain.safeAppsRpcUri,
        shortName: chain.shortName,
        theme: chain.theme,
        ensRegistryAddress: chain.ensRegistryAddress,
        isTestnet: chain.isTestnet,
        chainLogoUri: chain.chainLogoUri,
        balancesProvider: chain.balancesProvider,
        contractAddresses: chain.contractAddresses,
      });
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
    return new Chain({
      chainId: result.chainId,
      chainName: result.chainName,
      description: result.description,
      l2: result.l2,
      nativeCurrency: result.nativeCurrency,
      transactionService: result.transactionService,
      blockExplorerUriTemplate: result.blockExplorerUriTemplate,
      disabledWallets: result.disabledWallets,
      features: result.features,
      gasPrice: result.gasPrice,
      publicRpcUri: result.publicRpcUri,
      rpcUri: result.rpcUri,
      safeAppsRpcUri: result.safeAppsRpcUri,
      shortName: result.shortName,
      theme: result.theme,
      ensRegistryAddress: result.ensRegistryAddress,
      isTestnet: result.isTestnet,
      chainLogoUri: result.chainLogoUri,
      balancesProvider: result.balancesProvider,
      contractAddresses: result.contractAddresses,
    });
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

  async getMasterCopies(chainId: string): Promise<MasterCopy[]> {
    const result = await this.chainsRepository.getSingletons(chainId);

    return result.map((singleton) => ({
      address: singleton.address,
      version: singleton.version,
    }));
  }
}
