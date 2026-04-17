// SPDX-License-Identifier: FSL-1.1-MIT
import type { BridgeName } from '@/modules/bridge/domain/entities/bridge-name.entity';
import type { ExchangeName } from '@/modules/bridge/domain/entities/exchange-name.entity';

export type RoutePreference<T extends BridgeName | ExchangeName> =
  | T
  | 'all'
  | 'none'
  | 'default';

export type AllowDenyPrefer<T extends BridgeName | ExchangeName> = {
  allow?: Array<RoutePreference<T>>;
  deny?: Array<RoutePreference<T>>;
  prefer?: Array<RoutePreference<T>>;
};
