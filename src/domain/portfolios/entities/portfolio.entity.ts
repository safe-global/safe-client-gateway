export interface PortfolioPositionsDistributionByType {
  wallet: number;
  deposited: number;
  borrowed: number;
  locked: number;
  staked: number;
}

export interface PortfolioAttributes {
  positions_distribution_by_type: PortfolioPositionsDistributionByType;
  positions_distribution_by_chain: Record<string, number>;
  total: { positions: number };
}

export interface Portfolio {
  type: 'portfolio';
  id: string;
  attributes: PortfolioAttributes;
}

export interface PortfolioResponse {
  data: Portfolio;
}
