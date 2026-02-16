import { IConfigurationService } from '@/config/configuration.service.interface';
import { AwsCloudStorageApiService } from '@/datasources/storage/aws-cloud-storage-api.service';
import { ICloudStorageApiService } from '@/datasources/storage/cloud-storage-api.service';
import {
  AWS_ACCESS_KEY_ID,
  AWS_BASE_PATH,
  AWS_BUCKET_NAME,
  AWS_SECRET_ACCESS_KEY,
} from '@/datasources/storage/constants';
import { type DynamicModule, Module } from '@nestjs/common';

@Module({})
export class CloudStorageModule {
  static register(
    accessKeyId: string,
    secretAccessKey: string,
    bucketKey: string,
    basePathKey: string,
  ): DynamicModule {
    return {
      module: CloudStorageModule,
      providers: [
        {
          provide: AWS_ACCESS_KEY_ID,
          useFactory: (configService: IConfigurationService) =>
            configService.getOrThrow<string>(accessKeyId),
          inject: [IConfigurationService],
        },
        {
          provide: AWS_SECRET_ACCESS_KEY,
          useFactory: (configService: IConfigurationService) =>
            configService.getOrThrow<string>(secretAccessKey),
          inject: [IConfigurationService],
        },
        {
          provide: AWS_BUCKET_NAME,
          useFactory: (configService: IConfigurationService) =>
            configService.getOrThrow<string>(bucketKey),
          inject: [IConfigurationService],
        },
        {
          provide: AWS_BASE_PATH,
          useFactory: (configService: IConfigurationService) =>
            configService.getOrThrow<string>(basePathKey),
          inject: [IConfigurationService],
        },
        {
          provide: ICloudStorageApiService,
          useClass: AwsCloudStorageApiService,
        },
      ],
      exports: [ICloudStorageApiService],
    };
  }
}
