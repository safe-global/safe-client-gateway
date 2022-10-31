import { Module } from '@nestjs/common';
import { SafeAppsController } from './safe-apps.controller';
import { SafeAppsService } from './safe-apps.service';

@Module({
  controllers: [SafeAppsController],
  providers: [SafeAppsService],
})
export class SafeAppsModule {}
