import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { Order } from '@/domain/swaps/entities/order.entity';
import type { ISwapsApi } from '@/domain/interfaces/swaps-api.interface';
import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { FullAppData } from '@/domain/swaps/entities/full-app-data.entity';
import type { Raw } from '@/validation/entities/raw.entity';

/**
 * TODO: Move all usage of Raw to NetworkService after fully migrated
 * to "Raw" type implementation.
 */
export class CowSwapApi implements ISwapsApi {
  constructor(
    private readonly baseUrl: string,
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {}

  async getOrder(uid: string): Promise<Raw<Order>> {
    try {
      const url = `${this.baseUrl}/api/v1/orders/${uid}`;
      const { data } = await this.networkService.get<Raw<Order>>({ url });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getOrders(txHash: string): Promise<Raw<Array<Order>>> {
    try {
      const url = `${this.baseUrl}/api/v1/transactions/${txHash}/orders`;
      const { data } = await this.networkService.get<Raw<Array<Order>>>({
        url,
      });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getFullAppData(appDataHash: `0x${string}`): Promise<Raw<FullAppData>> {
    try {
      const url = `${this.baseUrl}/api/v1/app_data/${appDataHash}`;
      const { data } = await this.networkService.get<Raw<FullAppData>>({ url });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
