import type { PutObjectCommandInput } from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

export const ICloudStorageApiService = Symbol('ICloudStorageApiService');

export interface ICloudStorageApiService {
  getFileContent: (key: string) => Promise<string>;

  /**
   * Uploads a stream to S3
   * @param fileName The name of the file to upload
   * @param body The Readable stream containing the content to upload
   * @param options Additional options
   * @returns The S3 URI of the uploaded content
   */
  uploadStream: (
    fileName: string,
    body: Readable,
    options: Partial<PutObjectCommandInput>,
  ) => Promise<string>;
}
