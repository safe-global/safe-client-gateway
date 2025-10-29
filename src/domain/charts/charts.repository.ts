import { Inject, Injectable } from '@nestjs/common';
import { IChartsRepository } from '@/domain/charts/charts.repository.interface';
import { IChartApi } from '@/datasources/charts-api/zerion-chart-api.service';
import {
  Chart,
  ChartSchema,
  ChartPeriod,
} from '@/domain/charts/entities/chart.entity';
import {
  WalletChart,
  WalletChartSchema,
} from '@/domain/charts/entities/wallet-chart.entity';
import type { Address } from 'viem';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';

@Injectable()
export class ChartsRepository implements IChartsRepository {
  // Tiered TTL strategy based on data volatility
  private readonly chartCacheTtl: Record<ChartPeriod, number> = {
    [ChartPeriod.HOUR]: 60, // 1 minute
    [ChartPeriod.DAY]: 300, // 5 minutes
    [ChartPeriod.WEEK]: 900, // 15 minutes
    [ChartPeriod.MONTH]: 3600, // 1 hour
    [ChartPeriod.THREE_MONTHS]: 21600, // 6 hours
    [ChartPeriod.YEAR]: 43200, // 12 hours
    [ChartPeriod.MAX]: 86400, // 24 hours
  };

  constructor(
    @Inject(IChartApi) private readonly chartApi: IChartApi,
    @Inject(CacheService) private readonly cacheService: ICacheService,
  ) {}

  async getChart(args: {
    fungibleId: string;
    period: ChartPeriod;
    currency: string;
  }): Promise<Chart> {
    const cacheDir = CacheRouter.getFungibleChartCacheDir({
      fungibleId: args.fungibleId,
      period: args.period,
      currency: args.currency.toLowerCase(),
    });

    // Check cache first
    const cachedChart = await this.cacheService.hGet(cacheDir);
    if (cachedChart) {
      return ChartSchema.parse(JSON.parse(cachedChart));
    }

    // Fetch from API if not cached
    const rawChart = await this.chartApi.getChart({
      fungibleId: args.fungibleId,
      period: args.period,
      currency: args.currency,
    });

    const chart = ChartSchema.parse(rawChart);

    // Cache the result with tiered TTL
    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(chart),
      this.chartCacheTtl[args.period],
    );

    return chart;
  }

  async clearChart(args: {
    fungibleId: string;
    period: ChartPeriod;
    currency: string;
  }): Promise<void> {
    const cacheDir = CacheRouter.getFungibleChartCacheDir({
      fungibleId: args.fungibleId,
      period: args.period,
      currency: args.currency.toLowerCase(),
    });

    await this.cacheService.deleteByKey(cacheDir.key);
  }

  async getWalletChart(args: {
    address: Address;
    period: ChartPeriod;
    currency: string;
  }): Promise<WalletChart> {
    const cacheDir = CacheRouter.getWalletChartCacheDir({
      address: args.address,
      period: args.period,
      currency: args.currency.toLowerCase(),
    });

    const cachedChart = await this.cacheService.hGet(cacheDir);
    if (cachedChart) {
      return WalletChartSchema.parse(JSON.parse(cachedChart));
    }

    const rawChart = await this.chartApi.getWalletChart({
      address: args.address,
      period: args.period,
      currency: args.currency,
    });

    const chart = WalletChartSchema.parse(rawChart);

    await this.cacheService.hSet(
      cacheDir,
      JSON.stringify(chart),
      this.chartCacheTtl[args.period],
    );

    return chart;
  }

  async clearWalletChart(args: {
    address: Address;
    period: ChartPeriod;
    currency: string;
  }): Promise<void> {
    const cacheDir = CacheRouter.getWalletChartCacheDir({
      address: args.address,
      period: args.period,
      currency: args.currency.toLowerCase(),
    });

    await this.cacheService.deleteByKey(cacheDir.key);
  }
}
