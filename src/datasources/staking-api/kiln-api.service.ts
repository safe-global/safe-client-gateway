import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { IStakingApi } from '@/domain/interfaces/staking-api.interface';
import { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import { PooledStaking } from '@/datasources/staking-api/entities/pooled-staking.entity';
import { KilnStats } from '@/datasources/staking-api/entities/kiln-stats.entity';
import { Deployment } from '@/datasources/staking-api/entities/deployment.entity';

export class KilnStakingApi implements IStakingApi {
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

  async getKilnStats(): Promise<KilnStats> {
    try {
      const url = `${this.baseUrl}/v1/eth/kiln-stats`;
      // Note: Kiln always return { data: T }
      const { data } = await this.networkService.get<{ data: KilnStats }>({
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

  async getPooledStakingStats(pool: `0x${string}`): Promise<PooledStaking> {
    try {
      const url = `${this.baseUrl}/v1/eth/onchain/v2/network-stats`;
      // Note: Kiln always return { data: T }
      const { data } = await this.networkService.get<{
        data: PooledStaking;
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
}
