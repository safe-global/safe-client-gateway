import { Module } from '@nestjs/common';
import { HealthController } from '@/modules/health/routes/health.controller';
import { HealthService } from '@/modules/health/routes/health.service';
import { HealthRepositoryModule } from '@/modules/health/domain/health.repository.interface';

@Module({
  imports: [HealthRepositoryModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
