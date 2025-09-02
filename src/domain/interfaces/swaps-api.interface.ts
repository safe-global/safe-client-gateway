import type { FullAppData } from '@/domain/swaps/entities/full-app-data.entity';
import type { Order } from '@/domain/swaps/entities/order.entity';
import type { Raw } from '@/validation/entities/raw.entity';
import type { Hex } from 'viem';

export interface ISwapsApi {
  getOrder(uid: string): Promise<Raw<Order>>;

  getOrders(txHash: string): Promise<Raw<Array<Order>>>;

  getFullAppData(appDataHash: Hex): Promise<Raw<FullAppData>>;
}
