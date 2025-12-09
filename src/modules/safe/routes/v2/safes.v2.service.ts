import { Inject, Injectable } from '@nestjs/common';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import { IBalancesRepository } from '@/modules/balances/domain/balances.repository.interface';
import { IZerionWalletPortfolioApi } from '@/modules/balances/datasources/zerion-wallet-portfolio-api.service';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { SafeOverview } from '@/modules/safe/routes/entities/safe-overview.entity';
import { Caip10Addresses } from '@/modules/safe/routes/entities/caip-10-addresses.entity';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { getNumberString } from '@/domain/common/utils/utils';
import { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { Address } from 'viem';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';

@Injectable()
export class SafesV2Service {
  private readonly maxOverviews: number;
  private readonly zerionChainIds: Array<string>;

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
  ) {
    this.maxOverviews = configurationService.getOrThrow(
      'mappings.safe.maxOverviews',
    );
    this.zerionChainIds = configurationService.getOrThrow<Array<string>>(
      'features.zerionBalancesChainIds',
    );
  }

  async getSafeOverview(args: {
    currency: string;
    addresses: Caip10Addresses;
    trusted: boolean;
    excludeSpam: boolean;
    walletAddress?: Address;
  }): Promise<Array<SafeOverview>> {
    const limitedSafes = args.addresses.slice(0, this.maxOverviews);

    const settledOverviews = await Promise.allSettled(
      limitedSafes.map(async ({ chainId, address }) => {
        const chain = await this.chainsRepository.getChain(chainId);

        const [safe, fiatBalance] = await Promise.all([
          this.safeRepository.getSafe({
            chainId,
            address,
          }),
          this.getFiatBalance({
            chain,
            safeAddress: address,
            currency: args.currency,
            trusted: args.trusted,
            excludeSpam: args.excludeSpam,
          }),
        ]);

        const queue = await this.safeRepository.getTransactionQueue({
          chainId,
          safe,
        });

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
   * Gets fiat balance using Zerion wallet portfolio API for enabled chains,
   * falling back to balances repository for other chains.
   */
  private async getFiatBalance(args: {
    chain: Chain;
    safeAddress: Address;
    currency: string;
    trusted: boolean;
    excludeSpam: boolean;
  }): Promise<number> {
    const { chain, safeAddress, currency, trusted, excludeSpam } = args;

    // Check if this chain is enabled for Zerion portfolio
    if (this.zerionChainIds.includes(chain.chainId)) {
      return this.getFiatBalanceFromZerionPortfolio({
        chain,
        safeAddress,
        currency,
      });
    }

    // Fall back to v1 logic using balances repository
    return this.getFiatBalanceFromBalancesRepository({
      chain,
      safeAddress,
      currency,
      trusted,
      excludeSpam,
    });
  }

  /**
   * Gets fiat balance from Zerion Wallet Portfolio API.
   * Uses the /v1/wallets/{address}/portfolio endpoint.
   */
  private async getFiatBalanceFromZerionPortfolio(args: {
    chain: Chain;
    safeAddress: Address;
    currency: string;
  }): Promise<number> {
    const { chain, safeAddress, currency } = args;

    return this.zerionWalletPortfolioApi.getPortfolioTotal({
      address: safeAddress,
      currency,
      isTestnet: chain.isTestnet,
    });
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
    excludeSpam: boolean;
  }): Promise<number> {
    const { chain, safeAddress, currency, trusted, excludeSpam } = args;

    const balances = await this.balancesRepository.getBalances({
      chain,
      safeAddress,
      trusted,
      fiatCode: currency,
      excludeSpam,
    });

    return balances
      .filter((b) => b.fiatBalance !== null)
      .reduce((acc, b) => acc + Number(b.fiatBalance), 0);
  }

  private computeAwaitingConfirmation(args: {
    transactions: Array<MultisigTransaction>;
    walletAddress: Address;
  }): number {
    return args.transactions.reduce(
      (acc, { confirmationsRequired, confirmations }) => {
        const isConfirmed =
          !!confirmations && confirmations.length >= confirmationsRequired;
        const isSignable =
          !isConfirmed &&
          !confirmations?.some((confirmation) => {
            return confirmation.owner === args.walletAddress;
          });
        if (isSignable) {
          acc++;
        }
        return acc;
      },
      0,
    );
  }
}
