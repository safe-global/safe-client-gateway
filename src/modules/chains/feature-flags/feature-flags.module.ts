import { Module } from '@nestjs/common';
import { ChainsModule } from '@/modules/chains/chains.module';
import { FeatureFlagService } from '@/modules/chains/feature-flags/feature-flag.service';
import { IFeatureFlagService } from '@/modules/chains/feature-flags/feature-flag.service.interface';

@Module({
  imports: [ChainsModule],
  providers: [
    {
      provide: IFeatureFlagService,
      useClass: FeatureFlagService,
    },
  ],
  exports: [IFeatureFlagService],
})
export class FeatureFlagsModule {}
