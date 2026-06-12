// SPDX-License-Identifier: FSL-1.1-MIT
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { PortfolioRouteGuard } from '@/modules/portfolio/v1/guards/portfolio-route.guard';

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

describe('PortfolioRouteGuard', () => {
  let target: PortfolioRouteGuard;

  beforeEach(() => {
    jest.resetAllMocks();
    target = new PortfolioRouteGuard(mockConfigurationService);
  });

  it('should activate when features.zerionBalancesEnabled is true', () => {
    mockConfigurationService.getOrThrow.mockReturnValue(true);

    expect(target.canActivate()).toBe(true);
    expect(mockConfigurationService.getOrThrow).toHaveBeenCalledWith(
      'features.zerionBalancesEnabled',
    );
  });

  it('should not activate when features.zerionBalancesEnabled is false', () => {
    mockConfigurationService.getOrThrow.mockReturnValue(false);

    expect(target.canActivate()).toBe(false);
  });
});
