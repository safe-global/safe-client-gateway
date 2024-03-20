import { Inject, Injectable } from '@nestjs/common';
import { ISwapsApiFactory } from '@/domain/interfaces/swaps-api.factory';
import { Order, OrderSchema } from '@/domain/swaps/entities/order.entity';

@Injectable()
export class SwapsRepository {
  constructor(
    @Inject(ISwapsApiFactory)
    private readonly swapsApiFactory: ISwapsApiFactory,
  ) {}

  async getOrder(chainId: string, orderUid: `0x${string}`): Promise<Order> {
    const api = this.swapsApiFactory.get(chainId);
    const order = await api.getOrder(orderUid);
    return OrderSchema.parse(order);
  }
}
