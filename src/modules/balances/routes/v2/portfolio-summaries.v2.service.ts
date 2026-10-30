// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { ZodError } from 'zod';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { LimitReachedError } from '#/datasources/network/entities/errors/limit-reached.error';
import { LogType } from '#/domain/common/entities/log-type.entity';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import { getNumberString } from '#/domain/common/utils/utils';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import { IBalancesRepository } from '#/modules/balances/domain/balances.repository.interface';
import type { PortfolioSnapshot } from '#/modules/balances/domain/entities/portfolio-snapshot.entity';
import { IPortfolioSnapshotRepository } from '#/modules/balances/domain/portfolio-snapshot.repository.interface';
import {
  PortfolioSummary,
  PortfolioSummarySnapshot,
} from '#/modules/balances/routes/v2/entities/portfolio-summary.entity';
import type {
  ResolvedSafe,
  ZerionNetworks,
} from '#/modules/balances/routes/v2/entities/portfolio-summary-inputs.entity';
import { IChainsRepository } from '#/modules/chains/domain/chains.repository.interface';
import type { Chain } from '#/modules/chains/domain/entities/chain.entity';
import { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';
import { IZerionRepository } from '#/modules/zerion/domain/zerion.repository.interface';
import type { Caip10Address } from '#/validation/entities/schemas/caip-10-addresses.schema';

@Injectable()
export class PortfolioSummariesV2Service {
  private readonly maxSafes: number;
  private readonly currencies: Array<string>;
  private readonly zerionEnabled: boolean;
  private readonly zerionTestnetsEnabled: boolean;

  constructor(
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IZerionRepository)
    private readonly zerionRepository: IZerionRepository,
    @Inject(IPortfolioSnapshotRepository)
    private readonly portfolioSnapshotRepository: IPortfolioSnapshotRepository,
    @Inject(IBalancesRepository)
    private readonly balancesRepository: IBalancesRepository,
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.maxSafes = configurationService.getOrThrow<number>(
      'mappings.safe.maxOverviews',
    );
    this.currencies = configurationService.getOrThrow<Array<string>>(
      'balances.providers.zerion.currencies',
    );
    this.zerionEnabled =
      configurationService.getOrThrow<boolean>('features.zerion');
    this.zerionTestnetsEnabled = configurationService.getOrThrow<boolean>(
      'features.zerionTestnets',
    );
  }

  /**
   * Returns one summary per requested Safe, in request order. A Safe that
   * cannot be resolved, or whose value no source can provide, is logged and
   * left out; the other summaries are still returned.
   */
  async getSummaries(args: {
    safes: ReadonlyArray<Caip10Address>;
    currency: string;
    trusted: boolean;
  }): Promise<Array<PortfolioSummary>> {
    if (!this.currencies.includes(args.currency.toUpperCase())) {
      throw new HttpExceptionNoLog(
        `Unsupported currency code: ${args.currency}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const requested = this.dedupe(args.safes).slice(0, this.maxSafes);
    const chainsById = await this.resolveChains(requested);
    // Validate every Safe before any Zerion call, so a non-Safe address never
    // spends a paid call or the shared budget.
    const safes = await this.resolveSafes(requested, chainsById);
    const networks = await this.resolveZerionNetworks(
      safes.map(({ chain }) => chain),
    );
    const snapshots = await this.fetchSnapshotsOncePerWallet({
      safes: safes.filter(({ chain }) => this.getNetwork(chain, networks)),
      currency: args.currency,
      trusted: args.trusted,
    });

    const settled = await Promise.allSettled(
      safes.map((safe) =>
        this.buildSummary({
          ...safe,
          currency: args.currency,
          trusted: args.trusted,
          networks,
          snapshots,
        }),
      ),
    );

    const summaries: Array<PortfolioSummary> = [];
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        summaries.push(result.value);
      }
    }
    return summaries;
  }

  private dedupe(safes: ReadonlyArray<Caip10Address>): Array<Caip10Address> {
    const unique = new Map<string, Caip10Address>();
    for (const safe of safes) {
      unique.set(`${safe.chainId}:${safe.address}`, safe);
    }
    return [...unique.values()];
  }

  private async resolveChains(
    safes: ReadonlyArray<Caip10Address>,
  ): Promise<Map<string, Chain>> {
    const chainIds = [...new Set(safes.map(({ chainId }) => chainId))];
    const settled = await Promise.allSettled(
      chainIds.map((chainId) => this.chainsRepository.getChain(chainId)),
    );
    const chains = new Map<string, Chain>();
    settled.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        chains.set(chainIds[i], result.value);
      } else {
        this.loggingService.warn(
          `Error while getting chain ${chainIds[i]}: ${asError(result.reason)}`,
        );
      }
    });
    return chains;
  }

  private async resolveSafes(
    safes: ReadonlyArray<Caip10Address>,
    chainsById: Map<string, Chain>,
  ): Promise<Array<ResolvedSafe>> {
    const settled = await Promise.allSettled(
      safes.map(async ({ chainId, address }): Promise<ResolvedSafe> => {
        const chain = chainsById.get(chainId);
        if (!chain) {
          throw new Error(`Chain ${chainId} could not be resolved`);
        }
        await this.safeRepository.getSafe({ chainId, address });
        return { chain, address };
      }),
    );
    const resolved: Array<ResolvedSafe> = [];
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        resolved.push(result.value);
      } else {
        this.loggingService.warn(
          `Error while resolving Safe for portfolio summary: ${asError(result.reason)}`,
        );
      }
    }
    return resolved;
  }

  /**
   * Zerion's chain list decides which chains read the snapshot. It is fetched
   * once per environment present in the request; a failed lookup leaves that
   * environment empty, so its Safes fall back to the tx service.
   */
  private async resolveZerionNetworks(
    chains: Array<Chain>,
  ): Promise<Map<boolean, ZerionNetworks>> {
    const networks = new Map<boolean, ZerionNetworks>();
    if (!this.zerionEnabled) {
      return networks;
    }
    const environments = new Set(
      chains
        .filter((chain) => this.zerionTestnetsEnabled || !chain.isTestnet)
        .map((chain) => chain.isTestnet),
    );
    await Promise.all(
      [...environments].map(async (isTestnet) => {
        const byChainId = await this.getZerionNetworkNames(isTestnet);
        networks.set(isTestnet, {
          byChainId,
          chainIdByNetwork: new Map(
            Object.entries(byChainId).map(([chainId, network]) => [
              network,
              chainId,
            ]),
          ),
        });
      }),
    );
    return networks;
  }

  private async getZerionNetworkNames(
    isTestnet: boolean,
  ): Promise<Record<string, string>> {
    try {
      return await this.zerionRepository.getChainIdToNetworkMapping(isTestnet);
    } catch (error) {
      this.loggingService.warn({
        type: LogType.ZerionChainListError,
        source: 'PortfolioSummariesV2Service',
        event: 'Zerion chain lookup failed',
        isTestnet,
        detail: asError(error).message,
      });
      return {};
    }
  }

  private getNetwork(
    chain: Chain,
    networks: Map<boolean, ZerionNetworks>,
  ): string | undefined {
    return networks.get(chain.isTestnet)?.byChainId[chain.chainId];
  }

  /**
   * One Zerion snapshot covers every chain of an address in one environment,
   * so it is fetched once per (address, environment). A failed fetch is
   * logged and left out of the map; its Safes fall back to the tx service.
   */
  private async fetchSnapshotsOncePerWallet(args: {
    safes: Array<ResolvedSafe>;
    currency: string;
    trusted: boolean;
  }): Promise<Map<string, PortfolioSnapshot>> {
    const wallets = new Map<string, { address: Address; isTestnet: boolean }>();
    for (const { address, chain } of args.safes) {
      wallets.set(this.getWalletKey(address, chain), {
        address,
        isTestnet: chain.isTestnet,
      });
    }

    const snapshots = new Map<string, PortfolioSnapshot>();
    await Promise.all(
      [...wallets.entries()].map(async ([key, { address, isTestnet }]) => {
        try {
          snapshots.set(
            key,
            await this.portfolioSnapshotRepository.getSnapshot({
              address,
              isTestnet,
              currency: args.currency,
              trusted: args.trusted,
            }),
          );
        } catch (error) {
          this.logSnapshotError({ address, error });
        }
      }),
    );
    return snapshots;
  }

  private getWalletKey(address: Address, chain: Chain): string {
    return `${address}_${chain.isTestnet}`;
  }

  /**
   * Schema drift is an error (a contract break to investigate); being over
   * the Zerion budget is expected and already recorded by the limiter;
   * anything else is a warning.
   */
  private logSnapshotError(args: { address: Address; error: unknown }): void {
    const { address, error } = args;
    if (error instanceof ZodError) {
      this.loggingService.error({
        type: LogType.PortfolioRequestError,
        source: 'PortfolioSummariesV2Service',
        event: 'Portfolio schema drift',
        safeAddress: address,
        detail: error.message,
      });
    } else if (error instanceof LimitReachedError) {
      this.loggingService.debug({
        type: LogType.PortfolioRequestError,
        source: 'PortfolioSummariesV2Service',
        event: 'Portfolio over budget',
        safeAddress: address,
      });
    } else {
      this.loggingService.warn({
        type: LogType.PortfolioRequestError,
        source: 'PortfolioSummariesV2Service',
        event: 'Portfolio request failed',
        safeAddress: address,
        detail: asError(error).message,
      });
    }
  }

  private async buildSummary(args: {
    chain: Chain;
    address: Address;
    currency: string;
    trusted: boolean;
    networks: Map<boolean, ZerionNetworks>;
    snapshots: Map<string, PortfolioSnapshot>;
  }): Promise<PortfolioSummary> {
    const { chain, address } = args;
    const network = this.getNetwork(chain, args.networks);
    const snapshot = args.snapshots.get(this.getWalletKey(address, chain));

    if (network && snapshot) {
      return new PortfolioSummary({
        chainId: chain.chainId,
        address,
        // A chain missing from the distribution holds nothing: a real 0.
        fiatTotal: getNumberString(snapshot.fiatTotalByNetwork[network] ?? 0),
        source: 'zerion',
        snapshot: this.toSnapshotDto(
          snapshot,
          args.networks.get(chain.isTestnet)?.chainIdByNetwork ?? new Map(),
        ),
      });
    }

    const fiatTotal = await this.getTxServiceFiatTotal(args);
    if (network) {
      // The chain is on Zerion but its snapshot is unavailable.
      this.loggingService.warn({
        type: LogType.PortfolioDegradedServe,
        source: 'PortfolioSummariesV2Service',
        safeAddress: address,
        chainId: chain.chainId,
        balanceSource: 'balances_repo',
      });
    }
    return new PortfolioSummary({
      chainId: chain.chainId,
      address,
      fiatTotal: getNumberString(fiatTotal),
      source: 'tx_service',
      snapshot: null,
    });
  }

  /** Throws when the tx service fails, so the Safe is dropped, never shown a fabricated 0. */
  private async getTxServiceFiatTotal(args: {
    chain: Chain;
    address: Address;
    currency: string;
    trusted: boolean;
  }): Promise<number> {
    try {
      const balances = await this.balancesRepository.getBalances({
        chain: args.chain,
        safeAddress: args.address,
        fiatCode: args.currency,
        trusted: args.trusted,
      });
      return balances.reduce((total, { fiatBalance }) => {
        const value = Number(fiatBalance);
        return fiatBalance !== null && Number.isFinite(value)
          ? total + value
          : total;
      }, 0);
    } catch (error) {
      this.loggingService.warn({
        type: LogType.PortfolioDegradedServe,
        source: 'PortfolioSummariesV2Service',
        safeAddress: args.address,
        chainId: args.chain.chainId,
        balanceSource: 'unavailable',
        detail: asError(error).message,
      });
      throw error;
    }
  }

  private toSnapshotDto(
    snapshot: PortfolioSnapshot,
    chainIdByNetwork: Map<string, string>,
  ): PortfolioSummarySnapshot {
    const fiatTotalByChain: Record<string, string> = {};
    for (const [network, value] of Object.entries(
      snapshot.fiatTotalByNetwork,
    )) {
      const chainId = chainIdByNetwork.get(network);
      if (chainId) {
        fiatTotalByChain[chainId] = getNumberString(value);
      }
    }
    return new PortfolioSummarySnapshot({
      fiatTotal: getNumberString(snapshot.fiatTotal),
      fiatChange1d:
        snapshot.fiatChange1d === null
          ? null
          : getNumberString(snapshot.fiatChange1d),
      percentChange1d: snapshot.percentChange1d,
      fiatTotalByChain,
      fiatTotalByType: Object.fromEntries(
        Object.entries(snapshot.fiatTotalByType).map(([type, value]) => [
          type,
          getNumberString(value),
        ]),
      ),
      updatedAt: snapshot.updatedAt,
      expiresAt: snapshot.expiresAt,
    });
  }
}
