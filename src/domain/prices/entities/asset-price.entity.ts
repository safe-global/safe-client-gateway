export interface FiatPrice {
  [index: string]: number;
}

export interface AssetPrice {
  [index: string]: FiatPrice;
}
