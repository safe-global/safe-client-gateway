import { Inject, Injectable } from '@nestjs/common';
import { ISwapsApiFactory } from '@/domain/interfaces/swaps-api.factory';
import { Order } from '@/domain/swaps/entities/order.entity';
import { OrderValidator } from '@/domain/swaps/order.validator';

@Injectable()
export class SwapsRepository {
  constructor(
    @Inject(ISwapsApiFactory)
    private readonly swapsApiFactory: ISwapsApiFactory,
    private readonly orderValidator: OrderValidator,
  ) {}

  async getOrder(chainId: string, orderUid: string): Promise<Order> {
    const api = this.swapsApiFactory.get(chainId);
    const order = await api.getOrder(orderUid);
    return this.orderValidator.validate(order);
  }
}
