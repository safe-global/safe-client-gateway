import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { IStakingApi } from '@/domain/interfaces/staking-api.interface';
import { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import { PooledStakingStats } from '@/datasources/staking-api/entities/pooled-staking-stats.entity';
import { DedicatedStakingStats } from '@/datasources/staking-api/entities/dedicated-staking-stats.entity';
import { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import { DefiVaultStats } from '@/datasources/staking-api/entities/defi-vault-stats.entity';
import { Stake } from '@/datasources/staking-api/entities/stake.entity';

export class KilnApi implements IStakingApi {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {}

  async getDeployments(): Promise<Array<Deployment>> {
    try {
      const url = `${this.baseUrl}/v1/deployments`;
      // Note: Kiln always return { data: T }
      const { data } = await this.networkService.get<{
        data: Array<Deployment>;
      }>({
        url,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      });
      return data.data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getNetworkStats(): Promise<NetworkStats> {
    try {
      const url = `${this.baseUrl}/v1/eth/network-stats`;
      // Note: Kiln always return { data: T }
      const { data } = await this.networkService.get<{ data: NetworkStats }>({
        url,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      });
      return data.data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getDedicatedStakingStats(): Promise<DedicatedStakingStats> {
    try {
      const url = `${this.baseUrl}/v1/eth/kiln-stats`;
      // Note: Kiln always return { data: T }
      const { data } = await this.networkService.get<{
        data: DedicatedStakingStats;
      }>({
        url,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      });
      return data.data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getPooledStakingStats(
    pool: `0x${string}`,
  ): Promise<PooledStakingStats> {
    try {
      const url = `${this.baseUrl}/v1/eth/onchain/v2/network-stats`;
      // Note: Kiln always return { data: T }
      const { data } = await this.networkService.get<{
        data: PooledStakingStats;
      }>({
        url,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          params: {
            integration: pool,
          },
        },
      });
      return data.data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getDefiVaultStats(args: {
    chainId: string;
    vault: `0x${string}`;
  }): Promise<Array<DefiVaultStats>> {
    try {
      const url = `${this.baseUrl}/v1/defi/network-stats`;
      // Note: Kiln always return { data: T }
      const { data } = await this.networkService.get<{
        data: Array<DefiVaultStats>;
      }>({
        url,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          params: {
            vaults: this.getDefiVaultIdentifier(args),
          },
        },
      });
      return data.data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getStakes(validatorsPublicKeys: `0x${string}`[]): Promise<Stake[]> {
    try {
      const url = `${this.baseUrl}/v1/eth/stakes`;
      // Note: Kiln always return { data: T }
      const { data } = await this.networkService.get<{
        data: Array<Stake>;
      }>({
        url,
        networkRequest: {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          params: {
            validators: validatorsPublicKeys,
          },
        },
      });
      return data.data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  /**
   * Converts array of chainId and vault to DeFi vault identifier
   * @param args.chainId - chain ID
   * @param args.vault - vault address
   *
   * @returns array of DeFi vault identifiers - `chainIdentifier_vault`, e.g. `eth_0x123`
   * @see https://docs.api.kiln.fi/reference/getdefinetworkstats
   */
  private getDefiVaultIdentifier(args: {
    chainId: string;
    vault: `0x${string}`;
  }): string {
    const chainIdentifiers = {
      '1': 'eth',
      '42161': 'arb',
      '56': 'bsc',
      '137': 'matic',
      '10': 'op',
    };

    // Note: cannot narrow without it being a separate type guard
    const isDeFiSupportedChain = (
      chainId: string,
    ): chainId is keyof typeof chainIdentifiers => {
      return chainId in chainIdentifiers;
    };

    if (isDeFiSupportedChain(args.chainId)) {
      const chainIdentifier = chainIdentifiers[args.chainId];
      return `${chainIdentifier}_${args.vault}`;
    } else {
      throw new Error(`${args.chainId} is not supported for DeFi by Kiln`);
    }
  }
}
