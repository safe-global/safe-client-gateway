import { Module } from '@nestjs/common';
import { QueuesApiModule } from '@/modules/queues/datasources/queues-api.module';
import { IHealthRepository } from '@/modules/health/domain/health.repository.interface';
import { HealthRepository } from '@/modules/health/domain/health.repository';
import { HealthController } from '@/modules/health/routes/health.controller';
import { HealthService } from '@/modules/health/routes/health.service';

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
