import type { FullAppData } from '@/domain/swaps/entities/full-app-data.entity';
import type { Order } from '@/domain/swaps/entities/order.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export interface ISwapsApi {
  getOrder(uid: string): Promise<Raw<Order>>;

  getOrders(txHash: string): Promise<Raw<Array<Order>>>;

  getFullAppData(appDataHash: `0x${string}`): Promise<Raw<FullAppData>>;
}
