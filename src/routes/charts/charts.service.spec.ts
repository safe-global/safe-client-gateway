import { ChartsService } from '@/routes/charts/charts.service';
import type { IChartsRepository } from '@/domain/charts/charts.repository.interface';
import { ChartPeriod } from '@/domain/charts/entities/chart.entity';
import { chartBuilder } from '@/domain/charts/entities/__tests__/chart.builder';
import { faker } from '@faker-js/faker';

const mockChartsRepository = jest.mocked({
  getChart: jest.fn(),
  clearChart: jest.fn(),
} as jest.MockedObjectDeep<IChartsRepository>);

describe('ChartsService', () => {
  let service: ChartsService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ChartsService(mockChartsRepository);
  });

  describe('getChart', () => {
    it('should fetch chart from repository and map to API entity', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.DAY;
      const currency = 'usd';
      const domainChart = chartBuilder()
        .with('beginAt', '2024-01-01T00:00:00Z')
        .with('endAt', '2024-01-02T00:00:00Z')
        .with('stats', {
          first: 100,
          min: 95,
          avg: 102.5,
          max: 110,
          last: 105,
        })
        .with('points', [
          [1704067200, 100],
          [1704070800, 105],
        ])
        .build();

      mockChartsRepository.getChart.mockResolvedValue(domainChart);

      const result = await service.getChart({ fungibleId, period, currency });

      expect(mockChartsRepository.getChart).toHaveBeenCalledWith({
        fungibleId,
        period,
        currency,
      });

      expect(result).toEqual({
        beginAt: '2024-01-01T00:00:00Z',
        endAt: '2024-01-02T00:00:00Z',
        stats: {
          first: 100,
          min: 95,
          avg: 102.5,
          max: 110,
          last: 105,
        },
        points: [
          [1704067200, 100],
          [1704070800, 105],
        ],
      });
    });

    it('should work with all chart periods', async () => {
      const periods = [
        ChartPeriod.HOUR,
        ChartPeriod.DAY,
        ChartPeriod.WEEK,
        ChartPeriod.MONTH,
        ChartPeriod.THREE_MONTHS,
        ChartPeriod.YEAR,
        ChartPeriod.MAX,
      ];

      for (const period of periods) {
        const domainChart = chartBuilder().build();
        mockChartsRepository.getChart.mockResolvedValue(domainChart);

        await service.getChart({
          fungibleId: 'eth',
          period,
          currency: 'usd',
        });

        expect(mockChartsRepository.getChart).toHaveBeenCalledWith({
          fungibleId: 'eth',
          period,
          currency: 'usd',
        });
      }
    });

    it('should handle different fungible IDs', async () => {
      const fungibleIds = ['eth', 'btc', 'usdc', 'dai', 'link'];

      for (const fungibleId of fungibleIds) {
        const domainChart = chartBuilder().build();
        mockChartsRepository.getChart.mockResolvedValue(domainChart);

        await service.getChart({
          fungibleId,
          period: ChartPeriod.DAY,
          currency: 'usd',
        });

        expect(mockChartsRepository.getChart).toHaveBeenCalledWith({
          fungibleId,
          period: ChartPeriod.DAY,
          currency: 'usd',
        });
      }
    });

    it('should handle different currencies', async () => {
      const currencies = ['usd', 'eur', 'gbp', 'jpy'];

      for (const currency of currencies) {
        const domainChart = chartBuilder().build();
        mockChartsRepository.getChart.mockResolvedValue(domainChart);

        await service.getChart({
          fungibleId: 'eth',
          period: ChartPeriod.DAY,
          currency,
        });

        expect(mockChartsRepository.getChart).toHaveBeenCalledWith({
          fungibleId: 'eth',
          period: ChartPeriod.DAY,
          currency,
        });
      }
    });

    it('should preserve chart stats precision', async () => {
      const domainChart = chartBuilder()
        .with('stats', {
          first: 3456.789123,
          min: 3401.234567,
          avg: 3478.456789,
          max: 3567.891234,
          last: 3501.123456,
        })
        .build();

      mockChartsRepository.getChart.mockResolvedValue(domainChart);

      const result = await service.getChart({
        fungibleId: 'eth',
        period: ChartPeriod.DAY,
        currency: 'usd',
      });

      expect(result.stats).toEqual({
        first: 3456.789123,
        min: 3401.234567,
        avg: 3478.456789,
        max: 3567.891234,
        last: 3501.123456,
      });
    });

    it('should preserve empty points array', async () => {
      const domainChart = chartBuilder().with('points', []).build();

      mockChartsRepository.getChart.mockResolvedValue(domainChart);

      const result = await service.getChart({
        fungibleId: 'newtoken',
        period: ChartPeriod.MAX,
        currency: 'usd',
      });

      expect(result.points).toEqual([]);
    });

    it('should preserve large points array', async () => {
      const points: Array<[number, number]> = Array.from(
        { length: 1000 },
        (_, i) => {
          const timestamp = 1704067200 + i * 3600;
          const price = faker.number.float({ min: 1, max: 10000 });
          return [timestamp, price];
        },
      );

      const domainChart = chartBuilder().with('points', points).build();

      mockChartsRepository.getChart.mockResolvedValue(domainChart);

      const result = await service.getChart({
        fungibleId: 'eth',
        period: ChartPeriod.MAX,
        currency: 'usd',
      });

      expect(result.points).toHaveLength(1000);
      expect(result.points).toEqual(points);
    });

    it('should handle charts with zero values', async () => {
      const domainChart = chartBuilder()
        .with('stats', {
          first: 0,
          min: 0,
          avg: 0,
          max: 0,
          last: 0,
        })
        .with('points', [[1704067200, 0]])
        .build();

      mockChartsRepository.getChart.mockResolvedValue(domainChart);

      const result = await service.getChart({
        fungibleId: 'eth',
        period: ChartPeriod.HOUR,
        currency: 'usd',
      });

      expect(result.stats.first).toBe(0);
      expect(result.stats.last).toBe(0);
      expect(result.points[0][1]).toBe(0);
    });

    it('should propagate repository errors', async () => {
      const error = new Error('Repository error');
      mockChartsRepository.getChart.mockRejectedValue(error);

      await expect(
        service.getChart({
          fungibleId: 'eth',
          period: ChartPeriod.DAY,
          currency: 'usd',
        }),
      ).rejects.toThrow('Repository error');
    });
  });

  describe('clearChart', () => {
    it('should delegate cache clearing to repository', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.DAY;
      const currency = 'usd';

      await service.clearChart({ fungibleId, period, currency });

      expect(mockChartsRepository.clearChart).toHaveBeenCalledWith({
        fungibleId,
        period,
        currency,
      });
    });

    it('should clear cache for all periods', async () => {
      const fungibleId = 'btc';
      const currency = 'eur';
      const periods = [
        ChartPeriod.HOUR,
        ChartPeriod.DAY,
        ChartPeriod.WEEK,
        ChartPeriod.MONTH,
        ChartPeriod.THREE_MONTHS,
        ChartPeriod.YEAR,
        ChartPeriod.MAX,
      ];

      for (const period of periods) {
        await service.clearChart({ fungibleId, period, currency });
      }

      expect(mockChartsRepository.clearChart).toHaveBeenCalledTimes(
        periods.length,
      );
    });

    it('should clear cache for different fungible IDs', async () => {
      const period = ChartPeriod.DAY;
      const currency = 'usd';
      const fungibleIds = ['eth', 'btc', 'usdc'];

      for (const fungibleId of fungibleIds) {
        await service.clearChart({ fungibleId, period, currency });
      }

      expect(mockChartsRepository.clearChart).toHaveBeenCalledTimes(
        fungibleIds.length,
      );
    });

    it('should propagate repository errors during cache clear', async () => {
      const error = new Error('Cache clear failed');
      mockChartsRepository.clearChart.mockRejectedValue(error);

      await expect(
        service.clearChart({
          fungibleId: 'eth',
          period: ChartPeriod.DAY,
          currency: 'usd',
        }),
      ).rejects.toThrow('Cache clear failed');
    });
  });
});
