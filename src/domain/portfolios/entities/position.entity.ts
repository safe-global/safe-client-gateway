export interface PositionFungibleInfo {
  name: string | null;
  symbol: string | null;
  description: string | null;
  icon: { url: string | null };
  implementations: PositionFungibleInfoImplementation[];
}

export interface PositionFungibleInfoImplementation {
  chain_id: string;
  address: string | null;
  decimals: number;
}

export interface PositionQuantity {
  int: string;
  decimals: number;
  float: number;
  numeric: string;
}

export interface PositionAttributes {
  name: string;
  quantity: PositionQuantity;
  value: number | null;
  price: number;
  fungible_info: PositionFungibleInfo;
}

export interface Position {
  type: 'positions';
  id: string;
  attributes: PositionAttributes;
}

export interface PositionsResponse {
  data: Position[];
}
