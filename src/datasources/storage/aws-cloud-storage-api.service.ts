import type { ICloudStorageApiService } from '@/datasources/storage/cloud-storage-api.service';
import {
  AWS_BUCKET_NAME,
  AWS_BASE_PATH,
} from '@/datasources/storage/constants';
import { asError } from '@/logging/utils';
import { PutObjectCommandInput, S3 } from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import path from 'path';
import { Readable } from 'stream';

@Injectable()
export class AwsCloudStorageApiService implements ICloudStorageApiService {
  private readonly s3Client: S3;

  constructor(
    @Inject(AWS_BUCKET_NAME) private readonly bucket: string,
    @Inject(AWS_BASE_PATH) private readonly basePath: string,
  ) {
    this.s3Client = new S3();
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

  async uploadStream(
    fileName: string,
    body: Readable,
    options: Partial<PutObjectCommandInput> = {},
  ): Promise<string> {
    const key = path.posix.join(this.basePath, fileName);
    const params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: body,
      // e.g. ContentType: "text/csv",
      ...options,
    };

    try {
      await this.s3Client.putObject(params);
      return `s3://${this.bucket}/${key}`;
    } catch (err) {
      throw new Error(`Error uploading content to S3: ${asError(err).message}`);
    }
  }

  private async streamToString(stream: Readable): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const chunks: Array<Buffer> = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
  }
}
