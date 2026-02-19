import type { ICloudStorageApiService } from '@/datasources/storage/cloud-storage-api.service';
import {
  AWS_BUCKET_NAME,
  AWS_BASE_PATH,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
} from '@/datasources/storage/constants';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import {
  type CompleteMultipartUploadCommandOutput,
  GetObjectCommand,
  type PutObjectCommandInput,
  S3,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable } from '@nestjs/common';
import path from 'path';
import { Readable } from 'stream';

@Injectable()
export class AwsCloudStorageApiService implements ICloudStorageApiService {
  private readonly s3Client: S3;

  constructor(
    @Inject(AWS_ACCESS_KEY_ID) private readonly accessKeyId: string,
    @Inject(AWS_SECRET_ACCESS_KEY) private readonly secretAccessKey: string,
    @Inject(AWS_BUCKET_NAME) private readonly bucket: string,
    @Inject(AWS_BASE_PATH) private readonly basePath: string,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.s3Client = new S3({ credentials: { accessKeyId, secretAccessKey } });
  }
  async getFileContent(sourceFile: string): Promise<string> {
    try {
      const response = await this.s3Client.getObject({
        Bucket: this.bucket,
        Key: path.posix.join(this.basePath, sourceFile),
      });
      if (response.Body instanceof Readable) {
        return await this.streamToString(response.Body);
      } else {
        throw new Error('Unexpected response body type');
      }
    } catch (err) {
      throw new Error(
        `Error getting file content from S3: ${asError(err).message}`,
      );
    }
  }

  async createUploadStream(
    fileName: string,
    body: Readable,
    options: Partial<PutObjectCommandInput> = {},
  ): Promise<CompleteMultipartUploadCommandOutput> {
    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.bucket,
        Key: path.posix.join(this.basePath, fileName),
        Body: body,
        ...options,
      },
    });

    // Debugging: progress
    const progressListener = (p: {
      total?: number;
      loaded?: number;
      part?: number;
    }): void => {
      this.loggingService.debug({
        type: LogType.AwsCloudStorageUpload,
        total: p.total,
        loaded: p.loaded,
        part: p.part,
      });
    };

    upload.on('httpUploadProgress', progressListener);

    return upload.done().finally(() => {
      upload.off('httpUploadProgress', progressListener);
    });
  }

  async getSignedUrl(fileName: string, expiresIn: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: path.posix.join(this.basePath, fileName),
    });
    try {
      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (err) {
      throw new Error(
        `Error generating signed URL for S3: ${asError(err).message}`,
      );
    }
  }

  private async streamToString(stream: Readable): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const chunks: Array<Buffer> = [];

      const onData = (chunk: Buffer): void => {
        chunks.push(chunk);
      };

      const onError = (error: Error): void => {
        cleanup();
        reject(error);
      };

      const onEnd = (): void => {
        cleanup();
        resolve(Buffer.concat(chunks).toString('utf-8'));
      };

      const cleanup = (): void => {
        stream.off('data', onData);
        stream.off('error', onError);
        stream.off('end', onEnd);
      };

      stream.on('data', onData);
      stream.on('error', onError);
      stream.on('end', onEnd);
    });
  }
}
