// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { PortfolioRouteGuard } from '@/modules/portfolio/v1/guards/portfolio-route.guard';

const mockConfigurationService = {
  getOrThrow: vi.fn(),
} as MockedObject<IConfigurationService>;

describe('PortfolioRouteGuard', () => {
  let target: PortfolioRouteGuard;

  beforeEach(() => {
    vi.resetAllMocks();
    target = new PortfolioRouteGuard(mockConfigurationService);
  });

  it('should activate when features.zerionEnabled is true', () => {
    mockConfigurationService.getOrThrow.mockReturnValue(true);

    expect(target.canActivate()).toBe(true);
    expect(mockConfigurationService.getOrThrow).toHaveBeenCalledWith(
      'features.zerionEnabled',
    );
  });

  it('should not activate when features.zerionEnabled is false', () => {
    mockConfigurationService.getOrThrow.mockReturnValue(false);

    expect(target.canActivate()).toBe(false);
  });
});
