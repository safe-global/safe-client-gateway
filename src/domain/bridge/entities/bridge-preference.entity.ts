import type { BridgeName } from '@/domain/bridge/entities/bridge-name.entity';
import type { ExchangeName } from '@/domain/bridge/entities/exchange-name.entity';

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type RoutePreference<T extends BridgeName | ExchangeName> =
  | T
  | 'all'
  | 'none'
  | 'default';

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type AllowDenyPrefer<T extends BridgeName | ExchangeName> = {
  allow?: Array<RoutePreference<T>>;
  deny?: Array<RoutePreference<T>>;
  prefer?: Array<RoutePreference<T>>;
};
