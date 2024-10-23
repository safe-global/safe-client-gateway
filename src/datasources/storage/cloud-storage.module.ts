import { AwsCloudStorageApiService } from '@/datasources/storage/aws-cloud-storage-api.service';
import { ICloudStorageApiService } from '@/datasources/storage/cloud-storage-api.service';
import { Module } from '@nestjs/common';

@Module({
  providers: [
    {
      provide: ICloudStorageApiService,
      useClass: AwsCloudStorageApiService,
    },
  ],
  exports: [ICloudStorageApiService],
})
export class CloudStorageModule {}
