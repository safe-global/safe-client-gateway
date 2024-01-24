export interface ValkBalance {
  token_address: string;
  name: string;
  symbol: string;
  logo: string;
  thumbnail: string | null;
  decimals: number;
  balance: number;
  prices: Record<string, number>;
}
