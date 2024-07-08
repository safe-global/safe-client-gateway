import { Inject, Injectable } from '@nestjs/common';
import { ISwapsApiFactory } from '@/domain/interfaces/swaps-api.factory';
import {
  Order,
  OrderSchema,
  OrdersSchema,
} from '@/domain/swaps/entities/order.entity';
import {
  FullAppData,
  FullAppDataSchema,
} from '@/domain/swaps/entities/full-app-data.entity';

export const ISwapsRepository = Symbol('ISwapsRepository');

export interface ISwapsRepository {
  getOrder(chainId: string, orderUid: `0x${string}`): Promise<Order>;

  getOrders(chainId: string, txHash: string): Promise<Array<Order>>;

  getFullAppData(
    chainId: string,
    appDataHash: `0x${string}`,
  ): Promise<FullAppData>;

  clearApi(chainId: string): void;
}

@Injectable()
export class SwapsRepository implements ISwapsRepository {
  constructor(
    @Inject(ISwapsApiFactory)
    private readonly swapsApiFactory: ISwapsApiFactory,
  ) {}

  async getOrder(chainId: string, orderUid: `0x${string}`): Promise<Order> {
    const api = await this.swapsApiFactory.getApi(chainId);
    const order = await api.getOrder(orderUid);
    return OrderSchema.parse(order);
  }

  async getOrders(chainId: string, txHash: string): Promise<Array<Order>> {
    const api = await this.swapsApiFactory.getApi(chainId);
    const order = await api.getOrders(txHash);
    return OrdersSchema.parse(order);
  }

  async getFullAppData(
    chainId: string,
    appDataHash: `0x${string}`,
  ): Promise<FullAppData> {
    const api = await this.swapsApiFactory.getApi(chainId);
    const fullAppData = await api.getFullAppData(appDataHash);
    return FullAppDataSchema.parse(fullAppData);
  }

  clearApi(chainId: string): void {
    this.swapsApiFactory.destroyApi(chainId);
  }
}
