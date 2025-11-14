import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { CloudStorageModule } from '@/datasources/storage/cloud-storage.module';
import { OutreachDbMapper } from '@/modules/targeted-messaging/datasources/entities/outreach.db.mapper';
import { SubmissionDbMapper } from '@/modules/targeted-messaging/datasources/entities/submission.db.mapper';
import { TargetedSafeDbMapper } from '@/modules/targeted-messaging/datasources/entities/targeted-safe.db.mapper';
import { OutreachFileProcessor } from '@/modules/targeted-messaging/datasources/outreach-file-processor';
import { TargetedMessagingDatasource } from '@/modules/targeted-messaging/datasources/targeted-messaging.datasource';
import { ITargetedMessagingDatasource } from '@/domain/interfaces/targeted-messaging.datasource.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    PostgresDatabaseModule,
    CloudStorageModule.register(
      'targetedMessaging.fileStorage.aws.accessKeyId',
      'targetedMessaging.fileStorage.aws.secretAccessKey',
      'targetedMessaging.fileStorage.aws.bucketName',
      'targetedMessaging.fileStorage.aws.basePath',
    ),
  ],
  providers: [
    OutreachDbMapper,
    OutreachFileProcessor,
    SubmissionDbMapper,
    {
      provide: ITargetedMessagingDatasource,
      useClass: TargetedMessagingDatasource,
    },
    TargetedSafeDbMapper,
  ],
  exports: [ITargetedMessagingDatasource, OutreachFileProcessor],
})
export class TargetedMessagingDatasourceModule {}
