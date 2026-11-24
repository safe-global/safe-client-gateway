// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { CacheRouter } from '#/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '#/datasources/cache/cache.service.interface';
import { IChainsRepository } from '#/modules/chains/domain/chains.repository.interface';
import { IPortfolioService as DomainPortfolioService } from '#/modules/portfolio/domain/portfolio.service.interface';
import type { Portfolio } from '#/modules/portfolio/v1/entities/portfolio.entity';
import { PortfolioRouteMapper } from '#/modules/portfolio/v1/portfolio.mapper';
import { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';

/**
 * Portfolio API service.
 * Maps internal domain portfolio to internal API portfolio format.
 */
@Injectable()
export class PortfolioApiService {
  private readonly clearCooldownSeconds: number;
  private readonly recentClearSeconds: number;

  constructor(
    @Inject(DomainPortfolioService)
    private readonly domainPortfolioService: DomainPortfolioService,
    private readonly portfolioRouteMapper: PortfolioRouteMapper,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(IConfigurationService) configurationService: IConfigurationService,
  ) {
    this.clearCooldownSeconds = configurationService.getOrThrow<number>(
      'portfolio.clear.cooldownSeconds',
    );
    this.recentClearSeconds = configurationService.getOrThrow<number>(
      'portfolio.clear.recentClearSeconds',
    );
  }

  /**
   * Returns the portfolio of a Safe. The address must be a Safe on every
   * requested chain, checked before Zerion is called, so the paid portfolio
   * cannot be read for an arbitrary address.
   *
   * @param args - The Safe, its chains and the portfolio filters
   * @returns The portfolio of the Safe on the requested chains
   * @throws when the address is not a Safe on one of the chains (404)
   */
  public async getPortfolio(args: {
    address: Address;
    fiatCode: string;
    chainIds: Array<string>;
    trusted?: boolean;
    excludeDust?: boolean;
    sync?: boolean;
  }): Promise<Portfolio> {
    await this._assertSafeOnChains(args);
    const isTestnet = await this._areTestnetChains(args.chainIds);
    const domainPortfolio = await this.domainPortfolioService.getPortfolio({
      ...args,
      isTestnet,
    });
    return this.portfolioRouteMapper.mapDomainToRoute(domainPortfolio);
  }

  /**
   * Clears the Zerion caches of a Safe. The address must be a Safe on the
   * given chain, and repeat clears within the cooldown are skipped, so the
   * route cannot be used to force paid refetches. A clear is also skipped when
   * the caches were cleared moments ago: a transaction event clears them a few
   * seconds before the client asks, and clearing again would throw away a
   * snapshot that was paid for in between.
   */
  public async clearZerionCaches(args: {
    chainId: string;
    address: Address;
  }): Promise<void> {
    await this.safeRepository.getSafe(args);
    const clears = await this.cacheService.increment(
      CacheRouter.getPortfolioClearCooldownCacheKey({ address: args.address }),
      this.clearCooldownSeconds,
      0,
    );
    if (clears > 1 || (await this._wasClearedRecently(args.address))) {
      return;
    }
    await this.domainPortfolioService.clearZerionCaches({
      address: args.address,
    });
  }

  /**
   * Checks the address is a Safe on each chain, one chain at a time, so an
   * address that is not a Safe costs one lookup, not one per chain.
   *
   * @param args.address - The address to check
   * @param args.chainIds - The chains it must be a Safe on
   * @throws when the address is not a Safe on one of the chains (404)
   */
  private async _assertSafeOnChains(args: {
    address: Address;
    chainIds: Array<string>;
  }): Promise<void> {
    for (const chainId of args.chainIds) {
      await this.safeRepository.getSafe({ chainId, address: args.address });
    }
  }

  /**
   * Whether the Safe's caches were cleared, by an event or a request, within
   * the recent-clear window. Bounded to that window, not the whole settle
   * window, so a second transaction minutes later still gets its clear.
   *
   * @param address - The Safe address
   * @returns True if the last clear is younger than the window
   */
  private async _wasClearedRecently(address: Address): Promise<boolean> {
    const clearedAt = await this.domainPortfolioService.getClearedAt({
      address,
    });
    return (
      clearedAt !== null &&
      Date.now() - clearedAt < this.recentClearSeconds * 1_000
    );
  }

  /**
   * Determines if the provided chainIds are testnet chains.
   * Returns true if chainIds are provided and ALL of them are testnets.
   * Returns false if no chainIds provided or if any chain is not a testnet.
   */
  private async _areTestnetChains(chainIds?: Array<string>): Promise<boolean> {
    if (!chainIds || chainIds.length === 0) {
      return false;
    }

    const chains = await Promise.all(
      chainIds.map((chainId) =>
        this.chainsRepository.getChain(chainId).catch(() => null),
      ),
    );

    const validChains = chains.filter((chain) => chain !== null);
    if (validChains.length === 0) {
      return false;
    }

    return validChains.every((chain) => chain.isTestnet);
  }
}
