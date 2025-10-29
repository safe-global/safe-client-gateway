import type { Chart, ChartPeriod } from '@/domain/charts/entities/chart.entity';
import type { WalletChart } from '@/domain/charts/entities/wallet-chart.entity';
import type { Address } from 'viem';

export const IChartsRepository = Symbol('IChartsRepository');

export interface IChartsRepository {
  getChart(args: {
    fungibleId: string;
    period: ChartPeriod;
    currency: string;
  }): Promise<Chart>;

  clearChart(args: {
    fungibleId: string;
    period: ChartPeriod;
    currency: string;
  }): Promise<void>;

  getWalletChart(args: {
    address: Address;
    period: ChartPeriod;
    currency: string;
  }): Promise<WalletChart>;

  clearWalletChart(args: {
    address: Address;
    period: ChartPeriod;
    currency: string;
  }): Promise<void>;
}
