import { Module } from '@nestjs/common';
import { HealthController } from '@/routes/health/health.controller';
import { HealthService } from '@/routes/health/health.service';
import { HealthRepositoryModule } from '@/domain/health/health.repository.interface';

@Module({
  imports: [HealthRepositoryModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
