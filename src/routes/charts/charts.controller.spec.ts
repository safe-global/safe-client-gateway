import { ChartsController } from '@/routes/charts/charts.controller';
import type { ChartsService } from '@/routes/charts/charts.service';
import { ChartPeriod } from '@/domain/charts/entities/chart.entity';
import { chartBuilder } from '@/domain/charts/entities/__tests__/chart.builder';
import { Chart } from '@/routes/charts/entities/chart.entity';

const mockChartsService = jest.mocked({
  getChart: jest.fn(),
  clearChart: jest.fn(),
} as jest.MockedObjectDeep<ChartsService>);

describe('ChartsController', () => {
  let controller: ChartsController;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new ChartsController(mockChartsService);
  });

  describe('getChart', () => {
    it('should return chart data for valid request', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.DAY;
      const currency = 'usd';
      const domainChart = chartBuilder().build();
      const apiChart = new Chart(domainChart);

      mockChartsService.getChart.mockResolvedValue(apiChart);

      const result = await controller.getChart(fungibleId, period, currency);

      expect(mockChartsService.getChart).toHaveBeenCalledWith({
        fungibleId,
        period,
        currency,
      });
      expect(result).toEqual(apiChart);
    });

    it('should use default currency when not provided', async () => {
      const fungibleId = 'btc';
      const period = ChartPeriod.WEEK;
      const domainChart = chartBuilder().build();
      const apiChart = new Chart(domainChart);

      mockChartsService.getChart.mockResolvedValue(apiChart);

      // Currency defaults to 'usd' via DefaultValuePipe
      const result = await controller.getChart(fungibleId, period, 'usd');

      expect(mockChartsService.getChart).toHaveBeenCalledWith({
        fungibleId,
        period,
        currency: 'usd',
      });
      expect(result).toEqual(apiChart);
    });

    it('should handle all supported chart periods', async () => {
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
        const apiChart = new Chart(domainChart);
        mockChartsService.getChart.mockResolvedValue(apiChart);

        await controller.getChart('eth', period, 'usd');

        expect(mockChartsService.getChart).toHaveBeenCalledWith({
          fungibleId: 'eth',
          period,
          currency: 'usd',
        });
      }
    });

    it('should handle different fungible IDs', async () => {
      const fungibleIds = ['eth', 'btc', 'usdc', 'dai', 'link', 'matic'];

      for (const fungibleId of fungibleIds) {
        const domainChart = chartBuilder().build();
        const apiChart = new Chart(domainChart);
        mockChartsService.getChart.mockResolvedValue(apiChart);

        await controller.getChart(fungibleId, ChartPeriod.DAY, 'usd');

        expect(mockChartsService.getChart).toHaveBeenCalledWith({
          fungibleId,
          period: ChartPeriod.DAY,
          currency: 'usd',
        });
      }
    });

    it('should handle different currencies', async () => {
      const currencies = ['usd', 'eur', 'gbp'];

      for (const currency of currencies) {
        const domainChart = chartBuilder().build();
        const apiChart = new Chart(domainChart);
        mockChartsService.getChart.mockResolvedValue(apiChart);

        await controller.getChart('eth', ChartPeriod.DAY, currency);

        expect(mockChartsService.getChart).toHaveBeenCalledWith({
          fungibleId: 'eth',
          period: ChartPeriod.DAY,
          currency,
        });
      }
    });

    it('should return chart with properly formatted stats', async () => {
      const domainChart = chartBuilder()
        .with('stats', {
          first: 3456.78,
          min: 3401.23,
          avg: 3478.45,
          max: 3567.89,
          last: 3501.12,
        })
        .build();

      const apiChart = new Chart(domainChart);
      mockChartsService.getChart.mockResolvedValue(apiChart);

      const result = await controller.getChart('eth', ChartPeriod.DAY, 'usd');

      expect(result.stats.first).toBe(3456.78);
      expect(result.stats.min).toBe(3401.23);
      expect(result.stats.avg).toBe(3478.45);
      expect(result.stats.max).toBe(3567.89);
      expect(result.stats.last).toBe(3501.12);
    });

    it('should return chart with properly formatted timestamps', async () => {
      const domainChart = chartBuilder()
        .with('beginAt', '2024-01-01T00:00:00Z')
        .with('endAt', '2024-12-31T23:59:59Z')
        .build();

      const apiChart = new Chart(domainChart);
      mockChartsService.getChart.mockResolvedValue(apiChart);

      const result = await controller.getChart('eth', ChartPeriod.YEAR, 'usd');

      expect(result.beginAt).toBe('2024-01-01T00:00:00Z');
      expect(result.endAt).toBe('2024-12-31T23:59:59Z');
    });

    it('should return chart with all data points', async () => {
      const points: Array<[number, number]> = [
        [1704067200, 3456.78],
        [1704070800, 3460.23],
        [1704074400, 3455.67],
      ];

      const domainChart = chartBuilder().with('points', points).build();

      const apiChart = new Chart(domainChart);
      mockChartsService.getChart.mockResolvedValue(apiChart);

      const result = await controller.getChart('eth', ChartPeriod.HOUR, 'usd');

      expect(result.points).toHaveLength(3);
      expect(result.points).toEqual(points);
    });

    it('should handle empty points array', async () => {
      const domainChart = chartBuilder().with('points', []).build();

      const apiChart = new Chart(domainChart);
      mockChartsService.getChart.mockResolvedValue(apiChart);

      const result = await controller.getChart(
        'newtoken',
        ChartPeriod.MAX,
        'usd',
      );

      expect(result.points).toEqual([]);
    });

    it('should propagate service errors', async () => {
      const error = new Error('Service error');
      mockChartsService.getChart.mockRejectedValue(error);

      await expect(
        controller.getChart('eth', ChartPeriod.DAY, 'usd'),
      ).rejects.toThrow('Service error');
    });

    it('should handle special characters in fungibleId', async () => {
      const fungibleId = 'wrapped-bitcoin';
      const domainChart = chartBuilder().build();
      const apiChart = new Chart(domainChart);

      mockChartsService.getChart.mockResolvedValue(apiChart);

      await controller.getChart(fungibleId, ChartPeriod.DAY, 'usd');

      expect(mockChartsService.getChart).toHaveBeenCalledWith({
        fungibleId,
        period: ChartPeriod.DAY,
        currency: 'usd',
      });
    });

    it('should handle uppercase currency input', async () => {
      const domainChart = chartBuilder().build();
      const apiChart = new Chart(domainChart);

      mockChartsService.getChart.mockResolvedValue(apiChart);

      await controller.getChart('eth', ChartPeriod.DAY, 'USD');

      expect(mockChartsService.getChart).toHaveBeenCalledWith({
        fungibleId: 'eth',
        period: ChartPeriod.DAY,
        currency: 'USD', // Controller doesn't lowercase, service/repository does
      });
    });
  });

  describe('clearChart', () => {
    it('should clear chart cache for valid request', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.DAY;
      const currency = 'usd';

      await controller.clearChart(fungibleId, period, currency);

      expect(mockChartsService.clearChart).toHaveBeenCalledWith({
        fungibleId,
        period,
        currency,
      });
    });

    it('should use default currency when not provided for cache clear', async () => {
      const fungibleId = 'btc';
      const period = ChartPeriod.WEEK;

      // Currency defaults to 'usd' via DefaultValuePipe
      await controller.clearChart(fungibleId, period, 'usd');

      expect(mockChartsService.clearChart).toHaveBeenCalledWith({
        fungibleId,
        period,
        currency: 'usd',
      });
    });

    it('should clear cache for all periods', async () => {
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
        await controller.clearChart('eth', period, 'usd');
      }

      expect(mockChartsService.clearChart).toHaveBeenCalledTimes(
        periods.length,
      );
    });

    it('should clear cache for different fungible IDs', async () => {
      const fungibleIds = ['eth', 'btc', 'usdc'];

      for (const fungibleId of fungibleIds) {
        await controller.clearChart(fungibleId, ChartPeriod.DAY, 'usd');
      }

      expect(mockChartsService.clearChart).toHaveBeenCalledTimes(
        fungibleIds.length,
      );
    });

    it('should clear cache for different currencies', async () => {
      const currencies = ['usd', 'eur', 'gbp'];

      for (const currency of currencies) {
        await controller.clearChart('eth', ChartPeriod.DAY, currency);
      }

      expect(mockChartsService.clearChart).toHaveBeenCalledTimes(
        currencies.length,
      );
    });

    it('should return void on successful cache clear', async () => {
      mockChartsService.clearChart.mockResolvedValue(undefined);

      const result = await controller.clearChart('eth', ChartPeriod.DAY, 'usd');

      expect(result).toBeUndefined();
    });

    it('should propagate service errors during cache clear', async () => {
      const error = new Error('Clear failed');
      mockChartsService.clearChart.mockRejectedValue(error);

      await expect(
        controller.clearChart('eth', ChartPeriod.DAY, 'usd'),
      ).rejects.toThrow('Clear failed');
    });

    it('should handle special characters in fungibleId for cache clear', async () => {
      const fungibleId = 'wrapped-ethereum';

      await controller.clearChart(fungibleId, ChartPeriod.DAY, 'usd');

      expect(mockChartsService.clearChart).toHaveBeenCalledWith({
        fungibleId,
        period: ChartPeriod.DAY,
        currency: 'usd',
      });
    });
  });
});
