import { IConfigurationService } from '@/config/configuration.service.interface';
import type { ICloudStorageApiService } from '@/datasources/storage/cloud-storage-api.service';
import { asError } from '@/logging/utils';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import type { Readable } from 'stream';

@Injectable()
export class AwsCloudStorageApiService implements ICloudStorageApiService {
  private s3Client: S3Client;
  private readonly bucket: string;
  private readonly basePath: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.s3Client = new S3Client();
    this.basePath = this.configurationService.getOrThrow<string>(
      'targetedMessaging.fileStorage.aws.basePath',
    );
    this.bucket = this.configurationService.getOrThrow<string>(
      'targetedMessaging.fileStorage.aws.bucketName',
    );
  }

  async getFileContent(sourceFile: string): Promise<string> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: sourceFile }),
      );
      return await this.streamToString(response.Body as Readable);
    } catch (err) {
      throw new Error(
        `Error getting file content from S3: ${asError(err).message}`,
      );
    }
  }

  private async streamToString(stream: Readable): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
  }
}
