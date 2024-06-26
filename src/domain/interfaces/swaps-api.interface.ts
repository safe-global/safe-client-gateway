import { FullAppData } from '@/domain/swaps/entities/full-app-data.entity';
import { Order } from '@/domain/swaps/entities/order.entity';

export interface ISwapsApi {
  getOrder(uid: string): Promise<Order>;

  getOrders(txHash: string): Promise<Array<Order>>;

  getFullAppData(appDataHash: `0x${string}`): Promise<FullAppData>;
}
