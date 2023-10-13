import { Module } from '@nestjs/common';
import { HealthController } from '@/routes/health/health.controller';
import { HealthService } from '@/routes/health/health.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
