/**
 * These interfaces map Zerion responses for the list of wallet's fungible positions.
 * Reference documentation: https://developers.zerion.io/reference/listwalletpositions
 */

export interface ZerionFungibleInfo {
  name: string | null;
  symbol: string | null;
  description: string | null;
  icon: { url: string | null };
  implementations: ZerionImplementation[];
}

export interface ZerionImplementation {
  chain_id: string;
  address: string | null;
  decimals: number;
}

export interface ZerionQuantity {
  int: string;
  decimals: number;
  float: number;
  numeric: string;
}

export interface ZerionFlags {
  displayable: boolean;
}

export interface ZerionAttributes {
  name: string;
  quantity: ZerionQuantity;
  value: number | null;
  price: number;
  fungible_info: ZerionFungibleInfo;
  flags: ZerionFlags;
}

export interface ZerionBalance {
  type: 'positions';
  id: string;
  attributes: ZerionAttributes;
}

export interface ZerionBalances {
  data: ZerionBalance[];
}
