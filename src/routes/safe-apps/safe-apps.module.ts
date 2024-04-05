import { Module } from '@nestjs/common';
import { SafeAppsController } from '@/routes/safe-apps/safe-apps.controller';
import { SafeAppsService } from '@/routes/safe-apps/safe-apps.service';
import { SafeAppsRepositoryModule } from '@/domain/safe-apps/safe-apps.repository.interface';

@Module({
  imports: [SafeAppsRepositoryModule],
  controllers: [SafeAppsController],
  providers: [SafeAppsService],
})
export class SafeAppsModule {}
