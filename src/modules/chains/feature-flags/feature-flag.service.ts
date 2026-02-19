// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IFeatureFlagService } from '@/modules/chains/feature-flags/feature-flag.service.interface';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class FeatureFlagService implements IFeatureFlagService {
  private readonly cgwServiceKey: string;

  constructor(
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.cgwServiceKey = this.configurationService.getOrThrow<string>(
      'safeConfig.cgwServiceKey',
    );
  }

  async isFeatureEnabled(
    chainId: string,
    featureKey: string,
  ): Promise<boolean> {
    const chain = await this.chainsRepository.getChainV2(
      this.cgwServiceKey,
      chainId,
    );
    return chain.features.includes(featureKey);
  }
}
