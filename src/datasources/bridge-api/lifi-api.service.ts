import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { BridgeCalldata } from '@/domain/bridge/entities/bridge-calldata.entity';
import type { BridgeName } from '@/domain/bridge/entities/bridge-name.entity';
import type { BridgeStatus } from '@/domain/bridge/entities/bridge-status.entity';
import type { IBridgeApi } from '@/domain/interfaces/bridge-api.inferface';
import type { Raw } from '@/validation/entities/raw.entity';

export class LifiBridgeApi implements IBridgeApi {
  private static readonly LIFI_API_HEADER = 'x-lifi-api-key';

  constructor(
    private readonly chainId: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {}

  public async getStatus(args: {
    txHash: `0x${string}`;
    bridge?: BridgeName;
    toChainId?: string;
  }): Promise<Raw<BridgeStatus>> {
    try {
      const url = `${this.baseUrl}/v1/status`;
      const { data } = await this.networkService.get<BridgeStatus>({
        url,
        networkRequest: {
          params: {
            txHash: args.txHash,
            fromChainId: this.chainId,
            toChainId: args.toChainId,
            bridge: args.bridge,
          },
          headers: {
            [LifiBridgeApi.LIFI_API_HEADER]: this.apiKey,
          },
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  public async parseCalldata(
    callData: `0x${string}`,
  ): Promise<Raw<BridgeCalldata>> {
    try {
      const url = `${this.baseUrl}/v1/calldata/parse`;
      const { data } = await this.networkService.post<BridgeCalldata>({
        url,
        data: {
          chainId: this.chainId,
          callData,
        },
        networkRequest: {
          headers: {
            [LifiBridgeApi.LIFI_API_HEADER]: this.apiKey,
          },
        },
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
