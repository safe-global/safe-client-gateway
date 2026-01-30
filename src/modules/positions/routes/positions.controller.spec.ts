import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { PositionsService } from '@/modules/positions/routes/positions.service';
import { PositionsController } from '@/modules/positions/routes/positions.controller';
import type { Protocol } from '@/modules/positions/routes/entities/protocol.entity';

const service = {
  getPositions: jest.fn(),
} as jest.MockedObjectDeep<PositionsService>;

describe('PositionsController', () => {
  let controller: PositionsController;

  beforeEach(() => {
    jest.resetAllMocks();

    controller = new PositionsController(service);
  });

  describe('getPositions', () => {
    it('should call service with correct parameters', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.finance.currencyCode();
      const mockProtocols: Array<Protocol> = [];

      service.getPositions.mockResolvedValue(mockProtocols);

      const result = await controller.getPositions(
        chainId,
        safeAddress,
        fiatCode,
        false,
        false,
      );

      expect(service.getPositions).toHaveBeenCalledWith({
        chainId,
        safeAddress,
        fiatCode,
        refresh: false,
        sync: false,
      });
      expect(result).toBe(mockProtocols);
    });

    it('should pass refresh=true to service', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.finance.currencyCode();
      const mockProtocols: Array<Protocol> = [];

      service.getPositions.mockResolvedValue(mockProtocols);

      await controller.getPositions(
        chainId,
        safeAddress,
        fiatCode,
        true,
        false,
      );

      expect(service.getPositions).toHaveBeenCalledWith({
        chainId,
        safeAddress,
        fiatCode,
        refresh: true,
        sync: false,
      });
    });

    it('should pass sync=true to service', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.finance.currencyCode();
      const mockProtocols: Array<Protocol> = [];

      service.getPositions.mockResolvedValue(mockProtocols);

      await controller.getPositions(
        chainId,
        safeAddress,
        fiatCode,
        false,
        true,
      );

      expect(service.getPositions).toHaveBeenCalledWith({
        chainId,
        safeAddress,
        fiatCode,
        refresh: false,
        sync: true,
      });
    });

    it('should pass both refresh and sync flags when both are true', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.finance.currencyCode();
      const mockProtocols: Array<Protocol> = [];

      service.getPositions.mockResolvedValue(mockProtocols);

      await controller.getPositions(chainId, safeAddress, fiatCode, true, true);

      expect(service.getPositions).toHaveBeenCalledWith({
        chainId,
        safeAddress,
        fiatCode,
        refresh: true,
        sync: true,
      });
    });

    it('should return the protocols from service', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.finance.currencyCode();
      const mockProtocols = [
        { protocol: 'aave', fiatTotal: '100', items: [] },
        { protocol: 'compound', fiatTotal: '200', items: [] },
      ] as unknown as Array<Protocol>;

      service.getPositions.mockResolvedValue(mockProtocols);

      const result = await controller.getPositions(
        chainId,
        safeAddress,
        fiatCode,
        false,
        false,
      );

      expect(result).toEqual(mockProtocols);
    });
  });
});
