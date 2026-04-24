// SPDX-License-Identifier: FSL-1.1-MIT
import type { Hex } from 'viem';
import type { FullAppData } from '@/modules/swaps/domain/entities/full-app-data.entity';
import type { Order } from '@/modules/swaps/domain/entities/order.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export interface ISwapsApi {
  getOrder(uid: string): Promise<Raw<Order>>;

  getOrders(txHash: string): Promise<Raw<Array<Order>>>;

  getFullAppData(appDataHash: Hex): Promise<Raw<FullAppData>>;
}
