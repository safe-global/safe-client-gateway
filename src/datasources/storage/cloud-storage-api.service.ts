import type { PutObjectCommandInput } from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

export const ICloudStorageApiService = Symbol('ICloudStorageApiService');

export interface ICloudStorageApiService {
  /**
   * Retrieves the content of a file from S3
   * @param {string} key The key of the file
   * @returns {Promise<string>} The content of the file
   */
  getFileContent: (key: string) => Promise<string>;

  /**
   * Uploads a stream to S3
   * @param {string} fileName The name of the file to upload
   * @param {Readable} body The Readable stream containing the content to upload
   * @param {PutObjectCommandInput} options Additional CSV options
   * @returns {Promise<string>} The S3 URI of the uploaded content
   */
  uploadStream: (
    fileName: string,
    body: Readable,
    options: Partial<PutObjectCommandInput>,
  ) => Promise<string>;

  /**
   * Generates a signed URL for accessing a file in S3
   * @param {string} fileName The name of the file
   * @param {number} expiresIn The number of seconds until the URL expires
   * @returns {Promise<string>} The signed URL
   */
  getSignedUrl: (fileName: string, expiresIn: number) => Promise<string>;
}
