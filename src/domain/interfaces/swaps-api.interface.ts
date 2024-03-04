import { Order } from '@/domain/swaps/entities/order.entity';

export interface ISwapsApi {
  getOrder(uid: string): Promise<Order>;
}
