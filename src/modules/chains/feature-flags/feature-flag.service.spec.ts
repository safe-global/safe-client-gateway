// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { FeatureFlagService } from '@/modules/chains/feature-flags/feature-flag.service';
import type { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import type { IConfigurationService } from '@/config/configuration.service.interface';

const mockChainsRepository = {
  getChainV2: jest.fn(),
} as jest.MockedObjectDeep<IChainsRepository>;

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

describe('FeatureFlagService', () => {
  let target: FeatureFlagService;

  beforeEach(() => {
    jest.resetAllMocks();
    mockConfigurationService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'safeConfig.cgwServiceKey') return 'CGW';
      throw new Error(`Unexpected key: ${key}`);
    });
    target = new FeatureFlagService(
      mockChainsRepository,
      mockConfigurationService,
    );
  });

  describe('isFeatureEnabled', () => {
    it('should return true when feature flag exists in chain features', async () => {
      const chainId = faker.string.numeric();
      const featureKey = 'test-feature';
      const chain = chainBuilder()
        .with('chainId', chainId)
        .with('features', [featureKey, 'other-feature'])
        .build();
      mockChainsRepository.getChainV2.mockResolvedValueOnce(chain);

      const result = await target.isFeatureEnabled(chainId, featureKey);

      expect(result).toBe(true);
      expect(mockChainsRepository.getChainV2).toHaveBeenCalledTimes(1);
      expect(mockChainsRepository.getChainV2).toHaveBeenCalledWith(
        'CGW',
        chainId,
      );
    });

    it('should return false when feature flag is missing from chain features', async () => {
      const chainId = faker.string.numeric();
      const featureKey = 'missing-feature';
      const chain = chainBuilder()
        .with('chainId', chainId)
        .with('features', ['other-feature', 'another-feature'])
        .build();
      mockChainsRepository.getChainV2.mockResolvedValueOnce(chain);

      const result = await target.isFeatureEnabled(chainId, featureKey);

      expect(result).toBe(false);
      expect(mockChainsRepository.getChainV2).toHaveBeenCalledTimes(1);
      expect(mockChainsRepository.getChainV2).toHaveBeenCalledWith(
        'CGW',
        chainId,
      );
    });

    it('should throw when chain config is unavailable (Config Service errors)', async () => {
      const chainId = faker.string.numeric();
      const featureKey = 'test-feature';
      const error = new Error('Config Service unavailable');
      mockChainsRepository.getChainV2.mockRejectedValueOnce(error);

      await expect(
        target.isFeatureEnabled(chainId, featureKey),
      ).rejects.toThrow('Config Service unavailable');
    });

    it('should throw when chain config is unavailable (network issues)', async () => {
      const chainId = faker.string.numeric();
      const featureKey = 'test-feature';
      const error = new Error('Network timeout');
      mockChainsRepository.getChainV2.mockRejectedValueOnce(error);

      await expect(
        target.isFeatureEnabled(chainId, featureKey),
      ).rejects.toThrow('Network timeout');
    });

    it('should throw when chain does not exist', async () => {
      const chainId = '999';
      const featureKey = 'test-feature';
      const error = new Error('Chain not found');
      mockChainsRepository.getChainV2.mockRejectedValueOnce(error);

      await expect(
        target.isFeatureEnabled(chainId, featureKey),
      ).rejects.toThrow('Chain not found');
    });

    it('should fetch chain config on-demand when chain has not been fetched/cached yet', async () => {
      const chainId = faker.string.numeric();
      const featureKey = 'test-feature';
      const chain = chainBuilder()
        .with('chainId', chainId)
        .with('features', [featureKey])
        .build();
      mockChainsRepository.getChainV2.mockResolvedValueOnce(chain);

      const result = await target.isFeatureEnabled(chainId, featureKey);

      expect(result).toBe(true);
      expect(mockChainsRepository.getChainV2).toHaveBeenCalledTimes(1);
      expect(mockChainsRepository.getChainV2).toHaveBeenCalledWith(
        'CGW',
        chainId,
      );
    });

    it('should return false when features array is empty', async () => {
      const chainId = faker.string.numeric();
      const featureKey = 'test-feature';
      const chain = chainBuilder()
        .with('chainId', chainId)
        .with('features', [])
        .build();
      mockChainsRepository.getChainV2.mockResolvedValueOnce(chain);

      const result = await target.isFeatureEnabled(chainId, featureKey);

      expect(result).toBe(false);
    });
  });
});
