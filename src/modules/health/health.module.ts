// SPDX-License-Identifier: FSL-1.1-MIT
import { DynamicModule, Module } from '@nestjs/common';
import { QueuesApiModule } from '@/modules/queues/datasources/queues-api.module';
import { IHealthRepository } from '@/modules/health/domain/health.repository.interface';
import { HealthRepository } from '@/modules/health/domain/health.repository';
import { HealthController } from '@/modules/health/routes/health.controller';
import { HealthService } from '@/modules/health/routes/health.service';

export interface HealthModuleOptions {
  /**
   * Whether to include AMQP/RabbitMQ health checks.
   * Set to false for services that don't use message queues (e.g., auth-service).
   * @default true
   */
  includeQueues?: boolean;
}

@Module({})
export class HealthModule {
  static register(options: HealthModuleOptions = {}): DynamicModule {
    const { includeQueues = true } = options;

    return {
      module: HealthModule,
      imports: includeQueues ? [QueuesApiModule] : [],
      providers: [
        {
          provide: IHealthRepository,
          useClass: HealthRepository,
        },
        HealthService,
      ],
      controllers: [HealthController],
      exports: [IHealthRepository],
    };
  }
}
