import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { PortfolioApiService } from '@/modules/portfolio/v1/portfolio.service';
import { PortfolioController } from '@/modules/portfolio/v1/portfolio.controller';
import type { GetPortfolioDto } from '@/modules/portfolio/v1/entities/get-portfolio.dto.entity';
import type { Portfolio } from '@/modules/portfolio/v1/entities/portfolio.entity';

const service = {
  getPortfolio: jest.fn(),
  clearPortfolio: jest.fn(),
} as jest.MockedObjectDeep<PortfolioApiService>;

describe('PortfolioController', () => {
  let controller: PortfolioController;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new PortfolioController(service);
  });

  describe('getPortfolio', () => {
    it('should call service with address and DTO parameters', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const getPortfolioDto: GetPortfolioDto = {
        fiatCode: 'USD',
        chainIds: undefined,
        trusted: true,
        excludeDust: true,
        sync: false,
      };
      const mockPortfolio = {} as Portfolio;

      service.getPortfolio.mockResolvedValue(mockPortfolio);

      const result = await controller.getPortfolio(address, getPortfolioDto);

      expect(service.getPortfolio).toHaveBeenCalledWith({
        address,
        fiatCode: 'USD',
        chainIds: undefined,
        trusted: true,
        excludeDust: true,
        sync: false,
      });
      expect(result).toBe(mockPortfolio);
    });

    it('should pass custom fiatCode to service', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const getPortfolioDto: GetPortfolioDto = {
        fiatCode: 'EUR',
        chainIds: undefined,
        trusted: true,
        excludeDust: true,
        sync: false,
      };

      service.getPortfolio.mockResolvedValue({} as Portfolio);

      await controller.getPortfolio(address, getPortfolioDto);

      expect(service.getPortfolio).toHaveBeenCalledWith(
        expect.objectContaining({
          fiatCode: 'EUR',
        }),
      );
    });

    it('should pass chainIds array to service', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const getPortfolioDto: GetPortfolioDto = {
        fiatCode: 'USD',
        chainIds: ['1', '10', '137'],
        trusted: true,
        excludeDust: true,
        sync: false,
      };

      service.getPortfolio.mockResolvedValue({} as Portfolio);

      await controller.getPortfolio(address, getPortfolioDto);

      expect(service.getPortfolio).toHaveBeenCalledWith(
        expect.objectContaining({
          chainIds: ['1', '10', '137'],
        }),
      );
    });

    it('should pass trusted=false to service', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const getPortfolioDto: GetPortfolioDto = {
        fiatCode: 'USD',
        chainIds: undefined,
        trusted: false,
        excludeDust: true,
        sync: false,
      };

      service.getPortfolio.mockResolvedValue({} as Portfolio);

      await controller.getPortfolio(address, getPortfolioDto);

      expect(service.getPortfolio).toHaveBeenCalledWith(
        expect.objectContaining({
          trusted: false,
        }),
      );
    });

    it('should pass excludeDust=false to service', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const getPortfolioDto: GetPortfolioDto = {
        fiatCode: 'USD',
        chainIds: undefined,
        trusted: true,
        excludeDust: false,
        sync: false,
      };

      service.getPortfolio.mockResolvedValue({} as Portfolio);

      await controller.getPortfolio(address, getPortfolioDto);

      expect(service.getPortfolio).toHaveBeenCalledWith(
        expect.objectContaining({
          excludeDust: false,
        }),
      );
    });

    it('should pass sync=true to service', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const getPortfolioDto: GetPortfolioDto = {
        fiatCode: 'USD',
        chainIds: undefined,
        trusted: true,
        excludeDust: true,
        sync: true,
      };

      service.getPortfolio.mockResolvedValue({} as Portfolio);

      await controller.getPortfolio(address, getPortfolioDto);

      expect(service.getPortfolio).toHaveBeenCalledWith(
        expect.objectContaining({
          sync: true,
        }),
      );
    });

    it('should pass all parameters to service', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const getPortfolioDto: GetPortfolioDto = {
        fiatCode: 'EUR',
        chainIds: ['1', '10'],
        trusted: false,
        excludeDust: false,
        sync: true,
      };

      service.getPortfolio.mockResolvedValue({} as Portfolio);

      await controller.getPortfolio(address, getPortfolioDto);

      expect(service.getPortfolio).toHaveBeenCalledWith({
        address,
        fiatCode: 'EUR',
        chainIds: ['1', '10'],
        trusted: false,
        excludeDust: false,
        sync: true,
      });
    });

    it('should return portfolio from service', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const getPortfolioDto: GetPortfolioDto = {
        fiatCode: 'USD',
        chainIds: undefined,
        trusted: true,
        excludeDust: true,
        sync: false,
      };
      const mockPortfolio = {
        totalBalanceFiat: '1000',
        totalTokenBalanceFiat: '500',
        totalPositionsBalanceFiat: '500',
      } as Portfolio;

      service.getPortfolio.mockResolvedValue(mockPortfolio);

      const result = await controller.getPortfolio(address, getPortfolioDto);

      expect(result).toEqual(mockPortfolio);
    });
  });

  describe('clearPortfolio', () => {
    it('should call service with address', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      service.clearPortfolio.mockResolvedValue(undefined);

      await controller.clearPortfolio(address);

      expect(service.clearPortfolio).toHaveBeenCalledWith({
        address,
      });
    });

    it('should return void', async () => {
      const address = getAddress(faker.finance.ethereumAddress());

      service.clearPortfolio.mockResolvedValue(undefined);

      const result = await controller.clearPortfolio(address);

      expect(result).toBeUndefined();
    });
  });
});
