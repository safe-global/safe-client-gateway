import { Module } from '@nestjs/common';
import { SafeAppsController } from '@/modules/safe-apps/routes/safe-apps.controller';
import { SafeAppsService } from '@/modules/safe-apps/routes/safe-apps.service';
import { SafeAppsRepositoryModule } from '@/modules/safe-apps/domain/safe-apps.repository.interface';

@Module({
  imports: [SafeAppsRepositoryModule],
  controllers: [SafeAppsController],
  providers: [SafeAppsService],
})
export class SafeAppsModule {}
