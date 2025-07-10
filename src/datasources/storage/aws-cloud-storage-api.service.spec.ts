import { AwsCloudStorageApiService } from '@/datasources/storage/aws-cloud-storage-api.service';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { faker } from '@faker-js/faker/.';
import { sdkStreamMixin } from '@smithy/util-stream';
import { mockClient } from 'aws-sdk-client-mock';
import { Readable } from 'stream';

describe('AwsCloudStorageApiService', () => {
  const s3Mock = mockClient(S3Client);
  const bucketName = faker.string.alphanumeric();
  const basePath = 'base/path';

  const target = new AwsCloudStorageApiService(bucketName, basePath);

  describe('getFileContent', () => {
    it('should return file content', async () => {
      const content = faker.lorem.paragraphs();
      const sourceFile = faker.system.fileName();
      s3Mock
        .on(GetObjectCommand)
        .resolves({ Body: sdkStreamMixin(buildStream(content)) });

      const result = await target.getFileContent(sourceFile);

      expect(result).toBe(content);
      expect(
        s3Mock.commandCalls(GetObjectCommand, {
          Bucket: bucketName,
          Key: `base/path/${sourceFile}`,
        }),
      ).toHaveLength(1);
    });

    it('should normalize paths', async () => {
      const target = new AwsCloudStorageApiService(bucketName, 'base//path///');

      const content = faker.lorem.paragraphs();
      const sourceFile = '///source-file.json'; // Extra slashes should be normalized
      s3Mock
        .on(GetObjectCommand)
        .resolves({ Body: sdkStreamMixin(buildStream(content)) });

      const result = await target.getFileContent(sourceFile);

      expect(result).toBe(content);
      expect(
        s3Mock.commandCalls(GetObjectCommand, {
          Bucket: bucketName,
          Key: `base/path/source-file.json`,
        }),
      ).toHaveLength(1);
    });

    it('should throw error when getting file content fails', async () => {
      const sourceFile = faker.system.fileName();
      s3Mock.on(GetObjectCommand).rejects(new Error('S3 GetObject error'));

      // Ensure the method throws the expected error
      await expect(target.getFileContent(sourceFile)).rejects.toThrow(
        'Error getting file content from S3: S3 GetObject error',
      );
    });
  });

  describe('uploadStream', () => {
    it('should upload a stream to S3', async () => {
      const content = faker.lorem.paragraphs();
      const fileName = 'file.csv';
      const body = buildStream(content);

      s3Mock.on(PutObjectCommand).resolves({});

      const result = await target.uploadStream(fileName, body);
      expect(result).toBe(`s3://${bucketName}/base/path/${fileName}`);
      expect(
        s3Mock.commandCalls(PutObjectCommand, {
          Bucket: bucketName,
          Key: `base/path/${fileName}`,
        }),
      ).toHaveLength(1);
    });

    it('should throw error when upload fails', async () => {
      const fileName = 'file.csv';
      const body = buildStream(faker.lorem.paragraphs());

      s3Mock.on(PutObjectCommand).rejects(new Error('PutObject error'));

      await expect(target.uploadStream(fileName, body)).rejects.toThrow(
        'Error uploading content to S3: PutObject error',
      );
    });
  });
});

function buildStream(content: string): Readable {
  const stream = new Readable();
  stream.push(content);
  stream.push(null);
  return stream;
}
