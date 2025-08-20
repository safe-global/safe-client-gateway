import type {
  CompleteMultipartUploadCommandOutput,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
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
   * Creates an upload stream using Upload class for better streaming support
   * @param {string} fileName The name of the file to upload
   * @param {Readable} body The Readable stream containing the content to upload
   * @param {PutObjectCommandInput} options Additional CSV options
   * @returns {Promise<CompleteMultipartUploadCommandOutput>} The object containing the multipart Upload
   */
  createUploadStream: (
    fileName: string,
    body: Readable,
    options: Partial<PutObjectCommandInput>,
  ) => Promise<CompleteMultipartUploadCommandOutput>;

  /**
   * Generates a signed URL for accessing a file in S3
   * @param {string} fileName The name of the file
   * @param {number} expiresIn The number of seconds until the URL expires
   * @returns {Promise<string>} The signed URL
   */
  getSignedUrl: (fileName: string, expiresIn: number) => Promise<string>;
}
