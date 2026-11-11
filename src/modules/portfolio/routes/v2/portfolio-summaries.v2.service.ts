// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { ZodError } from 'zod';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { LimitReachedError } from '#/datasources/network/entities/errors/limit-reached.error';
import { LogType } from '#/domain/common/entities/log-type.entity';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import { IBalancesRepository } from '#/modules/balances/domain/balances.repository.interface';
import { IChainsRepository } from '#/modules/chains/domain/chains.repository.interface';
import type { Chain } from '#/modules/chains/domain/entities/chain.entity';
import type { PortfolioSnapshot } from '#/modules/portfolio/domain/entities/portfolio-snapshot.entity';
import { IPortfolioRepository } from '#/modules/portfolio/domain/portfolio.repository.interface';
import type { PortfolioSummary } from '#/modules/portfolio/routes/v2/entities/portfolio-summary.dto.entity';
import type {
  PortfolioSummaryRequest,
  ResolvedSafe,
} from '#/modules/portfolio/routes/v2/entities/portfolio-summary-request.entity';
import { PortfolioSummaryMapper } from '#/modules/portfolio/routes/v2/portfolio-summary.mapper';
import { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';
import { IZerionRepository } from '#/modules/zerion/domain/zerion.repository.interface';
import type { Caip10Address } from '#/validation/entities/schemas/caip-10-addresses.schema';

/**
 * Values each requested Safe from the portfolio snapshot GET /v1/portfolio
 * caches, one Zerion /positions call per wallet and environment, and from the
 * Transaction Service where Zerion cannot.
 */
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
    @Inject(IPortfolioRepository)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(IBalancesRepository)
    private readonly balancesRepository: IBalancesRepository,
    private readonly mapper: PortfolioSummaryMapper,
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
   *
   * @throws {HttpExceptionNoLog} 400 when the currency is not supported
   */
  async getSummaries(args: {
    safes: ReadonlyArray<Caip10Address>;
    currency: string;
    trusted: boolean;
  }): Promise<Array<PortfolioSummary>> {
    if (!this.currencies.includes(args.currency)) {
      throw new HttpExceptionNoLog(
        `Unsupported currency code: ${args.currency}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const requested = this.dedupe(args.safes).slice(0, this.maxSafes);
    const chainsById = await this.resolveChains(requested);
    // Validate every Safe before any Zerion call, so a non-Safe address never
    // spends a paid call or the shared budget.
    const safes = (await this.resolveSafes(requested, chainsById)).map(
      (safe): PortfolioSummaryRequest => ({
        ...safe,
        currency: args.currency,
        trusted: args.trusted,
      }),
    );
    const zerionChainIds = await this.getZerionChainIds(
      safes.map(({ chain }) => chain),
    );
    const onZerion = (safe: ResolvedSafe): boolean =>
      zerionChainIds.get(safe.chain.isTestnet)?.has(safe.chain.chainId) ??
      false;
    const snapshots = await this.fetchSnapshotsOncePerWallet(
      safes.filter(onZerion),
    );

    const settled = await Promise.allSettled(
      safes.map((safe) => {
        const snapshot = snapshots.get(this.getWalletKey(safe));
        if (onZerion(safe) && snapshot) {
          return Promise.resolve(
            this.mapper.fromSnapshot({
              chainId: safe.chain.chainId,
              address: safe.address,
              snapshot,
            }),
          );
        }
        return this.getTxServiceSummary({
          ...safe,
          isSnapshotMissing: onZerion(safe),
        });
      }),
    );
    return settled.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
  }

  private dedupe(safes: ReadonlyArray<Caip10Address>): Array<Caip10Address> {
    const unique = new Map<string, Caip10Address>();
    for (const safe of safes) {
      // Caip10AddressesSchema checksums addresses, so equal Safes share a key.
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
        // Debug: addresses come from the client, so anyone could flood the logs.
        this.loggingService.debug(
          `Error while resolving Safe for portfolio summary: ${asError(result.reason)}`,
        );
      }
    }
    return resolved;
  }

  /** A failed lookup leaves that environment empty, so its Safes fall back to the Transaction Service. */
  private async getZerionChainIds(
    chains: Array<Chain>,
  ): Promise<Map<boolean, Set<string>>> {
    const chainIds = new Map<boolean, Set<string>>();
    if (!this.zerionEnabled) {
      return chainIds;
    }
    const environments = new Set(
      chains
        .filter((chain) => this.zerionTestnetsEnabled || !chain.isTestnet)
        .map((chain) => chain.isTestnet),
    );
    await Promise.all(
      [...environments].map(async (isTestnet) => {
        try {
          const mapping =
            await this.zerionRepository.getChainIdToNetworkMapping(isTestnet);
          chainIds.set(isTestnet, new Set(Object.keys(mapping)));
        } catch (error) {
          this.loggingService.warn({
            type: LogType.ZerionChainListError,
            source: 'PortfolioSummariesV2Service',
            event: 'Zerion chain lookup failed',
            isTestnet,
            detail: asError(error).message,
          });
        }
      }),
    );
    return chainIds;
  }

  /** One snapshot covers every chain of an address, so it is fetched once per (address, environment). */
  private async fetchSnapshotsOncePerWallet(
    safes: Array<PortfolioSummaryRequest>,
  ): Promise<Map<string, PortfolioSnapshot>> {
    const wallets = new Map<string, PortfolioSummaryRequest>();
    for (const safe of safes) {
      wallets.set(this.getWalletKey(safe), safe);
    }

    const snapshots = new Map<string, PortfolioSnapshot>();
    await Promise.all(
      [...wallets.entries()].map(async ([key, wallet]) => {
        try {
          snapshots.set(
            key,
            await this.portfolioRepository.getPortfolioSnapshot({
              address: wallet.address,
              fiatCode: wallet.currency,
              trusted: wallet.trusted,
              isTestnet: wallet.chain.isTestnet,
            }),
          );
        } catch (error) {
          this.logSnapshotError({ address: wallet.address, error });
        }
      }),
    );
    return snapshots;
  }

  private getWalletKey(safe: ResolvedSafe): string {
    return `${safe.address}_${safe.chain.isTestnet}`;
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

  /** Throws when the Transaction Service fails, so the Safe is dropped rather than shown as 0. */
  private async getTxServiceSummary(
    args: PortfolioSummaryRequest & { isSnapshotMissing: boolean },
  ): Promise<PortfolioSummary> {
    if (args.isSnapshotMissing) {
      this.loggingService.warn({
        type: LogType.PortfolioDegradedServe,
        source: 'PortfolioSummariesV2Service',
        safeAddress: args.address,
        chainId: args.chain.chainId,
        balanceSource: 'balances_repo',
      });
    }
    try {
      const balances = await this.balancesRepository.getBalances({
        chain: args.chain,
        safeAddress: args.address,
        fiatCode: args.currency,
        trusted: args.trusted,
      });
      return this.mapper.fromBalances({
        chainId: args.chain.chainId,
        address: args.address,
        balances,
      });
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
}
