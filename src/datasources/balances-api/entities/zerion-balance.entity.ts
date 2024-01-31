interface ZerionPositionFungibleInfo {
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

interface ZerionPositionQuantity {
  int: string;
  decimals: number;
  float: number;
  numeric: string;
}

interface ZerionPositionFlags {
  displayable: boolean;
}

interface ZerionPositionAttributes {
  name: string;
  quantity: ZerionPositionQuantity;
  value: number | null;
  price: number;
  fungible_info: ZerionPositionFungibleInfo;
  flags: ZerionPositionFlags;
}

export interface ZerionBalance {
  type: 'positions';
  id: string;
  attributes: ZerionPositionAttributes;
}
