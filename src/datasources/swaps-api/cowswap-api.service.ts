import { INetworkService } from '@/datasources/network/network.service.interface';
import { Order } from '@/domain/swaps/entities/order.entity';
import { ISwapsApi } from '@/domain/interfaces/swaps-api.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { FullAppData } from '@/domain/swaps/entities/full-app-data.entity';

export class CowSwapApi implements ISwapsApi {
  constructor(
    private readonly baseUrl: string,
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {}

  async getOrder(uid: string): Promise<Order> {
    try {
      const url = `${this.baseUrl}/api/v1/orders/${uid}`;
      const { data } = await this.networkService.get<Order>({ url });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  async getFullAppData(appDataHash: `0x${string}`): Promise<FullAppData> {
    try {
      const url = `${this.baseUrl}/api/v1/app_data/${appDataHash}`;
      const { data } = await this.networkService.get<FullAppData>({ url });
      return data;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
