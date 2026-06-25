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
import { IFeatureFlagService } from '@/modules/chains/feature-flags/feature-flag.service.interface';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { Caip10Addresses } from '@/modules/safe/routes/entities/caip-10-addresses.entity';
import { SafeOverview } from '@/modules/safe/routes/entities/safe-overview.entity';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';

/**
 * Outcome of fetching one wallet-identity's Zerion portfolio: either the parsed
 * portfolio, or a `degraded` marker meaning the balance must come from the
 * fallback path (never a fabricated `$0`).
 */
type PortfolioResult =
  | { status: 'ok'; portfolio: ZerionWalletPortfolio }
  | { status: 'degraded' };

@Injectable()
export class SafesV2Service {
  private readonly maxOverviews: number;
  private readonly zerionBalancesEnabled: boolean;

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
    @Inject(IFeatureFlagService)
    private readonly featureFlagService: IFeatureFlagService,
  ) {
    this.maxOverviews = configurationService.getOrThrow(
      'mappings.safe.maxOverviews',
    );
    this.zerionBalancesEnabled = configurationService.getOrThrow<boolean>(
      'features.zerionBalancesEnabled',
    );
  }

  async getSafeOverview(args: {
    currency: string;
    addresses: Caip10Addresses;
    trusted: boolean;
    walletAddress?: Address;
  }): Promise<Array<SafeOverview>> {
    const limitedSafes = args.addresses.slice(0, this.maxOverviews);

    // The Zerion portfolio is per-wallet and contains every chain, so fetch it
    // once per wallet-identity instead of once per (chainId, address). The
    // per-chain work below (chain, Safe, queue) stays per entry.
    const chainsById = await this.resolveChains(limitedSafes);
    const zerionEnabledById = await this.resolveZerionEligibility(chainsById);
    const portfoliosByIdentity = await this.fetchPortfoliosOncePerIdentity({
      limitedSafes,
      chainsById,
      zerionEnabledById,
      currency: args.currency,
      trusted: args.trusted,
    });

    const settledOverviews = await Promise.allSettled(
      limitedSafes.map(async ({ chainId, address }) => {
        const chain = chainsById.get(chainId);
        if (!chain) {
          throw new Error(`Chain ${chainId} could not be resolved`);
        }

        const safe = await this.safeRepository.getSafe({ chainId, address });

        const [fiatBalance, queue] = await Promise.all([
          this.resolveFiatBalance({
            chain,
            safeAddress: address,
            currency: args.currency,
            trusted: args.trusted,
            zerionEnabled: zerionEnabledById.get(chainId) ?? false,
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
   * Resolves each unique chainId once (today the chain is fetched per entry).
   * A chain that fails to resolve maps to null; its Safes are dropped during
   * the per-entry build (as today), not the whole batch.
   */
  private async resolveChains(
    limitedSafes: Caip10Addresses,
  ): Promise<Map<string, Chain | null>> {
    const uniqueChainIds = [...new Set(limitedSafes.map((s) => s.chainId))];
    const entries = await Promise.all(
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
    );
    return new Map(entries);
  }

  /**
   * Determines, per unique chainId, whether the Zerion wallet-portfolio path is
   * active: Zerion enabled globally, a Zerion chain name exists, and the
   * PORTFOLIO_ENDPOINT feature flag is on for that chain.
   */
  private async resolveZerionEligibility(
    chainsById: Map<string, Chain | null>,
  ): Promise<Map<string, boolean>> {
    const entries = await Promise.all(
      [...chainsById.entries()].map(
        async ([chainId, chain]): Promise<[string, boolean]> => {
          if (
            !(
              this.zerionBalancesEnabled &&
              chain &&
              this.getZerionChainName(chain)
            )
          ) {
            return [chainId, false];
          }
          return [chainId, await this.isPortfolioEndpointFeatureEnabled(chain)];
        },
      ),
    );
    return new Map(entries);
  }

  /**
   * Fetches one portfolio per unique wallet-identity (address, isTestnet,
   * currency, trusted) among the Zerion-enabled entries. A failed fetch is
   * captured as `degraded` for that identity so every Safe on that wallet
   * degrades together rather than rejecting.
   */
  private async fetchPortfoliosOncePerIdentity(args: {
    limitedSafes: Caip10Addresses;
    chainsById: Map<string, Chain | null>;
    zerionEnabledById: Map<string, boolean>;
    currency: string;
    trusted: boolean;
  }): Promise<Map<string, PortfolioResult>> {
    const { limitedSafes, chainsById, zerionEnabledById, currency, trusted } =
      args;

    const identities = new Map<
      string,
      { address: Address; isTestnet: boolean }
    >();
    for (const { chainId, address } of limitedSafes) {
      const chain = chainsById.get(chainId);
      if (chain && zerionEnabledById.get(chainId)) {
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
    }

    const results = new Map<string, PortfolioResult>();
    await Promise.all(
      [...identities.entries()].map(async ([key, { address, isTestnet }]) => {
        try {
          const portfolio = await this.zerionWalletPortfolioApi.getPortfolio({
            address,
            currency,
            isTestnet,
            trusted,
          });
          results.set(key, { status: 'ok', portfolio });
        } catch (error) {
          this.logPortfolioFetchError({ address, error });
          results.set(key, { status: 'degraded' });
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

  private async isPortfolioEndpointFeatureEnabled(
    chain: Chain,
  ): Promise<boolean> {
    let isEnabled = false;
    try {
      isEnabled = await this.featureFlagService.isFeatureEnabled(
        chain.chainId,
        'PORTFOLIO_ENDPOINT',
      );
    } catch (error) {
      this.loggingService.warn(
        `Error while checking feature flag: ${asError(error)} `,
      );
    }
    return isEnabled;
  }

  /**
   * Resolves the fiat balance for one (chain, Safe). Zerion-enabled chains read
   * the per-chain slice of the wallet's portfolio; a degraded portfolio (or an
   * unmappable chain) falls back to the balances repository. Never returns a
   * fabricated `$0` for an unknown balance.
   */
  private async resolveFiatBalance(args: {
    chain: Chain;
    safeAddress: Address;
    currency: string;
    trusted: boolean;
    zerionEnabled: boolean;
    portfoliosByIdentity: Map<string, PortfolioResult>;
  }): Promise<number> {
    const { chain, safeAddress, currency, trusted, zerionEnabled } = args;

    if (!zerionEnabled) {
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
    const result = args.portfoliosByIdentity.get(key);

    if (result?.status === 'ok') {
      const value = this.extractChainFiatBalance(result.portfolio, chain);
      if (value !== null) {
        return value;
      }
      // Chain has no usable Zerion mapping despite the gate — degrade honestly.
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
   * an unmappable chain name or a non-finite value returns null (degrade).
   */
  private extractChainFiatBalance(
    portfolio: ZerionWalletPortfolio,
    chain: Chain,
  ): number | null {
    const zerionChainName = this.getZerionChainName(chain);
    if (!zerionChainName) {
      return null;
    }
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
   * Gets the Zerion chain name for a given chain from its balancesProvider.
   */
  private getZerionChainName(chain: Chain): string | undefined {
    return chain.balancesProvider?.chainName ?? undefined;
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
