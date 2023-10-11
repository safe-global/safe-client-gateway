import { Module } from '@nestjs/common';
import { SafeAppsController } from '@/routes/safe-apps/safe-apps.controller';
import { SafeAppsService } from '@/routes/safe-apps/safe-apps.service';

@Module({
  controllers: [SafeAppsController],
  providers: [SafeAppsService],
})
export class SafeAppsModule {}
