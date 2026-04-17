import { Module } from '@nestjs/common';
import { HealthRepository } from '@/modules/health/domain/health.repository';
import { IHealthRepository } from '@/modules/health/domain/health.repository.interface';
import { HealthController } from '@/modules/health/routes/health.controller';
import { HealthService } from '@/modules/health/routes/health.service';
import { QueuesApiModule } from '@/modules/queues/datasources/queues-api.module';

@Module({
  imports: [QueuesApiModule],
  providers: [
    {
      provide: IHealthRepository,
      useClass: HealthRepository,
    },
    HealthService,
  ],
  controllers: [HealthController],
  exports: [IHealthRepository],
})
export class HealthModule {}
