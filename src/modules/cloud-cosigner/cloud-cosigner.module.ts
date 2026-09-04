// SPDX-License-Identifier: FSL-1.1-MIT
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/configuration';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { JobQueueService } from '@/datasources/job-queue/job-queue.service';
import { JobQueueShutdownHook } from '@/datasources/job-queue/job-queue.shutdown.hook';
import { CLOUD_COSIGNER_QUEUE } from '@/domain/common/jobs.constants';
import { IJobQueueService } from '@/domain/interfaces/job-queue.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { BalancesModule } from '@/modules/balances/balances.module';
import { ChainsModule } from '@/modules/chains/chains.module';
import { AnthropicApi } from '@/modules/cloud-cosigner/datasources/anthropic-api.service';
import { CloudCosignerPolicy } from '@/modules/cloud-cosigner/datasources/entities/cloud-cosigner-policy.entity.db';
import { CloudCosignerReview } from '@/modules/cloud-cosigner/datasources/entities/cloud-cosigner-review.entity.db';
import { CloudCosignerRepository } from '@/modules/cloud-cosigner/domain/cloud-cosigner.repository';
import { ICloudCosignerRepository } from '@/modules/cloud-cosigner/domain/cloud-cosigner.repository.interface';
import { CloudCosignerEventsSubscriber } from '@/modules/cloud-cosigner/domain/cloud-cosigner-events.subscriber';
import { CloudCosignerPolicyService } from '@/modules/cloud-cosigner/domain/cloud-cosigner-policy.service';
import { CloudCosignerReviewService } from '@/modules/cloud-cosigner/domain/cloud-cosigner-review.service';
import { CloudCosignerConsumer } from '@/modules/cloud-cosigner/domain/consumers/cloud-cosigner.consumer';
import { ICosignerSigner } from '@/modules/cloud-cosigner/domain/signers/cosigner-signer.interface';
import { KmsCosignerSigner } from '@/modules/cloud-cosigner/domain/signers/kms-cosigner-signer.service';
import { LocalCosignerSigner } from '@/modules/cloud-cosigner/domain/signers/local-cosigner-signer.service';
import { TransactionReviewer } from '@/modules/cloud-cosigner/domain/transaction-reviewer.service';
import { CloudCosignerController } from '@/modules/cloud-cosigner/routes/cloud-cosigner.controller';
import { CloudCosignerService } from '@/modules/cloud-cosigner/routes/cloud-cosigner.service';
import { CloudCosignerRateLimitGuard } from '@/modules/cloud-cosigner/routes/guards/cloud-cosigner-rate-limit.guard';
import { DataDecoderModule } from '@/modules/data-decoder/data-decoder.module';
import { QueuesRepositoryModule } from '@/modules/queues/domain/queues-repository.interface';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';

// A KMS key wins over a raw private key whenever both are configured; the
// configuration schema already forbids the raw key in deployed environments.
const hasKmsSigner = !!configuration().cloudCosigner.signer.kms.keyId;

/**
 * The cloud cosigner: an owner-as-a-service that reviews proposed Safe
 * transactions against a per-Safe policy and, when they pass, adds its
 * confirmation. Imported only by `CosignerAppModule`, never by the gateway.
 */
@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: CLOUD_COSIGNER_QUEUE,
      useFactory: (configService: IConfigurationService) => ({
        defaultJobOptions: {
          removeOnComplete: configService.get(
            'cloudCosigner.queue.removeOnComplete',
          ),
          removeOnFail: configService.get('cloudCosigner.queue.removeOnFail'),
          backoff: configService.get('cloudCosigner.queue.backoff'),
          attempts: configService.get<number>('cloudCosigner.queue.attempts'),
        },
      }),
      inject: [IConfigurationService],
    }),
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([CloudCosignerPolicy, CloudCosignerReview]),
    QueuesRepositoryModule,
    SafeRepositoryModule,
    ChainsModule,
    BalancesModule,
    DataDecoderModule,
  ],
  controllers: [CloudCosignerController],
  providers: [
    {
      provide: IJobQueueService,
      useFactory: (queue: Queue): IJobQueueService =>
        new JobQueueService(queue),
      inject: [getQueueToken(CLOUD_COSIGNER_QUEUE)],
    },
    {
      provide: JobQueueShutdownHook,
      useFactory: (
        queue: Queue,
        logging: ILoggingService,
      ): JobQueueShutdownHook => new JobQueueShutdownHook(queue, logging),
      inject: [getQueueToken(CLOUD_COSIGNER_QUEUE), LoggingService],
    },
    {
      provide: ICosignerSigner,
      useClass: hasKmsSigner ? KmsCosignerSigner : LocalCosignerSigner,
    },
    { provide: ICloudCosignerRepository, useClass: CloudCosignerRepository },
    AnthropicApi,
    TransactionReviewer,
    CloudCosignerPolicyService,
    CloudCosignerReviewService,
    CloudCosignerEventsSubscriber,
    CloudCosignerConsumer,
    CloudCosignerService,
    CloudCosignerRateLimitGuard,
  ],
})
export class CloudCosignerModule {}
