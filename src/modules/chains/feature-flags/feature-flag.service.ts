// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IFeatureFlagService } from '@/modules/chains/feature-flags/feature-flag.service.interface';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

@Injectable()
export class FeatureFlagService implements IFeatureFlagService {
  private readonly cgwServiceKey: string;

  constructor(
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.cgwServiceKey = this.configurationService.getOrThrow<string>(
      'safeConfig.cgwServiceKey',
    );
  }

  async isFeatureEnabled(
    chainId: string,
    featureKey: string,
  ): Promise<boolean> {
    try {
      const chain = await this.chainsRepository.getChainV2(
        this.cgwServiceKey,
        chainId,
      );
      return chain.features.includes(featureKey);
    } catch (error) {
      this.loggingService.warn({
        message: 'Unable to fetch chain configuration for feature flag check',
        chainId,
        featureKey,
        error,
      });
      return false;
    }
  }
}
