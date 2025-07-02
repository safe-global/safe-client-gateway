import type { PutObjectCommandInput } from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

export const ICloudStorageApiService = Symbol('ICloudStorageApiService');

export interface ICloudStorageApiService {
  getFileContent: (key: string) => Promise<string>;

  /**
   * Uploads a stream to S3
   * @param bucket The name of the S3 bucket
   * @param key The key where the content will be stored in the bucket
   * @param body The Readable stream containing the content to upload
   * @param options Additional options
   * @returns The S3 URI of the uploaded content
   */
  uploadStream: (
    bucket: string,
    key: string,
    body: Readable,
    options: Partial<PutObjectCommandInput>,
  ) => Promise<string>;
}
