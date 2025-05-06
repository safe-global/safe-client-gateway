import type { BridgeName } from '@/domain/bridge/entities/bridge-name.entity';
import type { ExchangeName } from '@/domain/bridge/entities/exchange-name.entity';

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type RoutePreference<T extends BridgeName | ExchangeName> =
  | T
  | 'all'
  | 'none'
  | 'default';
