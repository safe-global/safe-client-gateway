export interface ZapperV2Token {
  tokenAddress: string;
  network: { name: string; chainId: number };
  symbol: string;
  name?: string;
  decimals: number | null;
  balance: number;
  balanceUSD: number;
  balanceInCurrency?: number;
  price?: number;
  imgUrlV2?: string;
  verified?: boolean;
  onchainMarketData?: {
    priceChange24h?: number;
    price?: number;
  };
}

export interface ZapperV2App {
  app: {
    displayName: string;
    imgUrl: string;
    slug: string;
  };
  network: { name: string; chainId: number };
  balanceUSD: number;
  balanceInCurrency?: number;
  positionBalances: {
    edges: Array<{
      node: {
        address: string;
        network: string;
        symbol: string;
        name?: string;
        decimals: number;
        balance: string;
        balanceUSD: number;
        groupLabel: string;
        displayProps?: {
          label?: string;
        };
      };
    }>;
  };
}

export interface ZapperResponse {
  portfolioV2: {
    tokenBalances: {
      totalBalanceUSD: number;
      byToken: {
        edges: Array<{ node: ZapperV2Token }>;
      };
    };
    appBalances: {
      totalBalanceUSD: number;
      byApp: {
        edges: Array<{ node: ZapperV2App }>;
      };
    };
  };
}
