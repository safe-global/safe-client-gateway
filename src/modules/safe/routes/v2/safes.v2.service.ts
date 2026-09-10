// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { ZodError } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { LimitReachedError } from '@/datasources/network/entities/errors/limit-reached.error';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { getNumberString } from '@/domain/common/utils/utils';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import type { ZerionWalletPortfolio } from '@/modules/balances/datasources/entities/zerion-wallet-portfolio.entity';
import { IZerionWalletPortfolioApi } from '@/modules/balances/datasources/zerion-wallet-portfolio-api.service';
import { IBalancesRepository } from '@/modules/balances/domain/balances.repository.interface';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { Caip10Addresses } from '@/modules/safe/routes/entities/caip-10-addresses.entity';
import { SafeOverview } from '@/modules/safe/routes/entities/safe-overview.entity';
import { IZerionRepository } from '@/modules/zerion/domain/zerion.repository.interface';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';

/**
 * A (chainId, address) entry whose chain and Safe have been resolved up front,
 * so the balance fetch can run without re-validating or risking a wasted
 * external call for a non-Safe address.
 */
type ResolvedEntry = {
  chainId: string;
  address: Address;
  chain: Chain;
  safe: Safe;
};

@Injectable()
export class SafesV2Service {
  private readonly maxOverviews: number;
  private readonly zerionEnabled: boolean;

  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(IBalancesRepository)
    private readonly balancesRepository: IBalancesRepository,
    @Inject(IZerionWalletPortfolioApi)
    private readonly zerionWalletPortfolioApi: IZerionWalletPortfolioApi,
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IZerionRepository)
    private readonly zerionRepository: IZerionRepository,
  ) {
    this.maxOverviews = configurationService.getOrThrow(
      'mappings.safe.maxOverviews',
    );
    this.zerionEnabled =
      configurationService.getOrThrow<boolean>('features.zerion');
  }

  async getSafeOverview(args: {
    currency: string;
    addresses: Caip10Addresses;
    trusted: boolean;
    walletAddress?: Address;
  }): Promise<Array<SafeOverview>> {
    const limitedSafes = args.addresses.slice(0, this.maxOverviews);

    const chainsById = await this.resolveChains(limitedSafes);
    const zerionChainNamesById = await this.resolveZerionChainNames(chainsById);

    // Validate each Safe before any external balance fetch, so a non-Safe or
    // stale address never spends a Zerion call or consumes the shared budget.
    const resolvedEntries = await this.resolveSafes(limitedSafes, chainsById);

    // The Zerion portfolio is per-wallet and contains every chain, so fetch it
    // once per wallet-identity instead of once per (chainId, address).
    const portfoliosByIdentity = await this.fetchPortfoliosOncePerIdentity({
      entries: resolvedEntries.filter(({ chainId }) =>
        zerionChainNamesById.has(chainId),
      ),
      currency: args.currency,
      trusted: args.trusted,
    });

    const settledOverviews = await Promise.allSettled(
      resolvedEntries.map(async ({ chainId, address, chain, safe }) => {
        const [fiatBalance, queue] = await Promise.all([
          this.resolveFiatBalance({
            chain,
            safeAddress: address,
            currency: args.currency,
            trusted: args.trusted,
            zerionChainName: zerionChainNamesById.get(chainId),
            portfoliosByIdentity,
          }),
          this.safeRepository.getTransactionQueue({ chainId, safe }),
        ]);

        const awaitingConfirmation = args.walletAddress
          ? this.computeAwaitingConfirmation({
              transactions: queue.results,
              walletAddress: args.walletAddress,
            })
          : null;

        return new SafeOverview(
          new AddressInfo(safe.address),
          chainId,
          safe.threshold,
          safe.owners.map((ownerAddress) => new AddressInfo(ownerAddress)),
          getNumberString(fiatBalance),
          queue.count ?? 0,
          awaitingConfirmation,
        );
      }),
    );

    const safeOverviews: Array<SafeOverview> = [];

    for (const safeOverview of settledOverviews) {
      if (safeOverview.status === 'rejected') {
        this.loggingService.warn(
          `Error while getting Safe overview: ${asError(safeOverview.reason)} `,
        );
      } else if (safeOverview.status === 'fulfilled') {
        safeOverviews.push(safeOverview.value);
      }
    }

    return safeOverviews;
  }

  /**
   * Resolves and validates the Safe for each entry up front. Entries whose
   * chain or Safe cannot be resolved are logged and dropped here — before any
   * Zerion call — so a non-Safe address never consumes the shared budget.
   */
  private async resolveSafes(
    limitedSafes: Caip10Addresses,
    chainsById: Map<string, Chain | null>,
  ): Promise<Array<ResolvedEntry>> {
    const settled = await Promise.allSettled(
      limitedSafes.map(async ({ chainId, address }): Promise<ResolvedEntry> => {
        const chain = chainsById.get(chainId);
        if (!chain) {
          throw new Error(`Chain ${chainId} could not be resolved`);
        }
        const safe = await this.safeRepository.getSafe({ chainId, address });
        return { chainId, address, chain, safe };
      }),
    );

    const resolved: Array<ResolvedEntry> = [];
    for (const entry of settled) {
      if (entry.status === 'rejected') {
        this.loggingService.warn(
          `Error while getting Safe overview: ${asError(entry.reason)} `,
        );
      } else {
        resolved.push(entry.value);
      }
    }
    return resolved;
  }

  /**
   * Resolves each unique chainId once (today the chain is fetched per entry).
   * A chain that fails to resolve maps to null; its Safes are dropped during
   * the per-entry build (as today), not the whole batch.
   */
  private async resolveChains(
    limitedSafes: Caip10Addresses,
  ): Promise<Map<string, Chain | null>> {
    const uniqueChainIds = [...new Set(limitedSafes.map((s) => s.chainId))];
    return new Map(
      await Promise.all(
        uniqueChainIds.map(async (chainId): Promise<[string, Chain | null]> => {
          try {
            return [chainId, await this.chainsRepository.getChain(chainId)];
          } catch (error) {
            this.loggingService.warn(
              `Error while getting chain ${chainId}: ${asError(error)} `,
            );
            return [chainId, null];
          }
        }),
      ),
    );
  }

  /**
   * Zerion's chain list is the source of truth for which chains use the
   * portfolio path; it is fetched once per environment in the request. A chain
   * Zerion does not list, or a failed lookup, is absent and uses the fallback.
   */
  private async resolveZerionChainNames(
    chainsById: Map<string, Chain | null>,
  ): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    if (!this.zerionEnabled) {
      return names;
    }
    const chains = [...chainsById.values()].filter(
      (chain): chain is Chain => chain !== null,
    );
    const none: Record<string, string> = {};
    const [mainnet, testnet] = await Promise.all([
      chains.some((chain) => !chain.isTestnet)
        ? this.getZerionNetworkNames(false)
        : none,
      chains.some((chain) => chain.isTestnet)
        ? this.getZerionNetworkNames(true)
        : none,
    ]);
    for (const chain of chains) {
      const name = (chain.isTestnet ? testnet : mainnet)[chain.chainId];
      if (name) {
        names.set(chain.chainId, name);
      }
    }
    return names;
  }

  /** Empty on failure so every chain of that environment degrades to the fallback. */
  private async getZerionNetworkNames(
    isTestnet: boolean,
  ): Promise<Record<string, string>> {
    try {
      return await this.zerionRepository.getNetworkNamesByChainId(isTestnet);
    } catch (error) {
      this.loggingService.warn({
        type: LogType.ZerionChainListError,
        source: 'SafesV2Service',
        event: 'Zerion chain lookup failed',
        isTestnet,
        detail: asError(error).message,
      });
      return {};
    }
  }

  /**
   * Fetches one portfolio per unique wallet-identity (address, isTestnet,
   * currency, trusted) among the given entries. A failed fetch is
   * omitted from the map (and logged), so every Safe on that wallet degrades
   * together via the fallback rather than rejecting.
   */
  private async fetchPortfoliosOncePerIdentity(args: {
    entries: Array<ResolvedEntry>;
    currency: string;
    trusted: boolean;
  }): Promise<Map<string, ZerionWalletPortfolio>> {
    const { entries, currency, trusted } = args;

    const identities = new Map<
      string,
      { address: Address; isTestnet: boolean }
    >();
    for (const { address, chain } of entries) {
      const key = this.getPortfolioIdentityKey({
        address,
        isTestnet: chain.isTestnet,
        currency,
        trusted,
      });
      if (!identities.has(key)) {
        identities.set(key, { address, isTestnet: chain.isTestnet });
      }
    }

    const results = new Map<string, ZerionWalletPortfolio>();
    await Promise.all(
      [...identities.entries()].map(async ([key, { address, isTestnet }]) => {
        try {
          const portfolio = await this.zerionWalletPortfolioApi.getPortfolio({
            address,
            currency,
            isTestnet,
            trusted,
          });
          results.set(key, portfolio);
        } catch (error) {
          this.logPortfolioFetchError({ address, error });
        }
      }),
    );
    return results;
  }

  private getPortfolioIdentityKey(args: {
    address: Address;
    isTestnet: boolean;
    currency: string;
    trusted: boolean;
  }): string {
    return `${args.address}_${args.isTestnet}_${args.currency}_${args.trusted}`;
  }

  /**
   * Logs a portfolio fetch failure by type. Schema drift is an error (a
   * contract break to investigate); rate limiting is expected degradation (the
   * limiter already records it); everything else is a warning. In all cases the
   * wallet degrades to the balances-repository path — it is never dropped here.
   */
  private logPortfolioFetchError(args: {
    address: Address;
    error: unknown;
  }): void {
    const { address, error } = args;
    if (error instanceof ZodError) {
      this.loggingService.error({
        type: LogType.PortfolioRequestError,
        source: 'SafesV2Service',
        event: 'Portfolio schema drift',
        safeAddress: address,
        detail: error.message,
      });
    } else if (error instanceof LimitReachedError) {
      this.loggingService.debug({
        type: LogType.PortfolioRequestError,
        source: 'SafesV2Service',
        event: 'Portfolio over budget',
        safeAddress: address,
      });
    } else {
      this.loggingService.warn({
        type: LogType.PortfolioRequestError,
        source: 'SafesV2Service',
        event: 'Portfolio request failed',
        safeAddress: address,
        detail: asError(error).message,
      });
    }
  }

  /**
   * Resolves the fiat balance for one (chain, Safe). Zerion-supported chains
   * read the per-chain slice of the wallet's portfolio; a degraded portfolio
   * falls back to the balances repository. Never returns a fabricated `$0` for
   * an unknown balance.
   */
  private async resolveFiatBalance(args: {
    chain: Chain;
    safeAddress: Address;
    currency: string;
    trusted: boolean;
    zerionChainName: string | undefined;
    portfoliosByIdentity: Map<string, ZerionWalletPortfolio>;
  }): Promise<number> {
    const { chain, safeAddress, currency, trusted, zerionChainName } = args;

    if (!zerionChainName) {
      return await this.getFiatBalanceFromBalancesRepository({
        chain,
        safeAddress,
        currency,
        trusted,
      });
    }

    const key = this.getPortfolioIdentityKey({
      address: safeAddress,
      isTestnet: chain.isTestnet,
      currency,
      trusted,
    });
    const portfolio = args.portfoliosByIdentity.get(key);

    if (portfolio) {
      const value = this.extractChainFiatBalance(portfolio, zerionChainName);
      if (value !== null) {
        return value;
      }
    }

    return await this.serveDegradedBalance({
      chain,
      safeAddress,
      currency,
      trusted,
    });
  }

  /**
   * Reads the per-chain fiat value from a successful portfolio. A chain missing
   * from the distribution is a real `0` (the wallet holds nothing there). Only
   * a non-finite value returns null (degrade).
   */
  private extractChainFiatBalance(
    portfolio: ZerionWalletPortfolio,
    zerionChainName: string,
  ): number | null {
    const value =
      portfolio.data.attributes.positions_distribution_by_chain[
        zerionChainName
      ] ?? 0;
    return Number.isFinite(value) ? value : null;
  }

  /**
   * Serves a balance via the balances-repository fallback when the portfolio is
   * unavailable. Emits a degraded-serve metric. If the fallback also fails the
   * error propagates so the Safe is dropped — never shown a fabricated `$0`.
   */
  private async serveDegradedBalance(args: {
    chain: Chain;
    safeAddress: Address;
    currency: string;
    trusted: boolean;
  }): Promise<number> {
    try {
      const value = await this.getFiatBalanceFromBalancesRepository(args);
      this.loggingService.warn({
        type: LogType.PortfolioDegradedServe,
        source: 'SafesV2Service',
        safeAddress: args.safeAddress,
        chainId: args.chain.chainId,
        balanceSource: 'balances_repo',
      });
      return value;
    } catch (error) {
      this.loggingService.warn({
        type: LogType.PortfolioDegradedServe,
        source: 'SafesV2Service',
        safeAddress: args.safeAddress,
        chainId: args.chain.chainId,
        balanceSource: 'unavailable',
        detail: asError(error).message,
      });
      throw error;
    }
  }

  /**
   * Gets fiat balance from balances repository (v1 logic).
   * Aggregates fiatBalance from individual token balances.
   */
  private async getFiatBalanceFromBalancesRepository(args: {
    chain: Chain;
    safeAddress: Address;
    currency: string;
    trusted: boolean;
  }): Promise<number> {
    const { chain, safeAddress, currency, trusted } = args;

    const balances = await this.balancesRepository.getBalances({
      chain,
      safeAddress,
      trusted,
      fiatCode: currency,
    });

    return balances
      .filter((b) => b.fiatBalance !== null)
      .reduce((acc, b) => {
        const value = Number(b.fiatBalance);
        return Number.isFinite(value) ? acc + value : acc;
      }, 0);
  }

  private computeAwaitingConfirmation(args: {
    transactions: Array<MultisigTransaction>;
    walletAddress: Address;
  }): number {
    return args.transactions.reduce(
      (acc, { confirmationsRequired, confirmations }) => {
        const isConfirmed =
          !!confirmations && confirmations.length >= confirmationsRequired;
        const isSignable = !(
          isConfirmed ||
          confirmations?.some((confirmation) => {
            return confirmation.owner === args.walletAddress;
          })
        );
        if (isSignable) {
          return acc + 1;
        }
        return acc;
      },
      0,
    );
  }
}
