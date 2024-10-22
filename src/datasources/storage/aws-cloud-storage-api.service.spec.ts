import type { IConfigurationService } from '@/config/configuration.service.interface';
import { AwsCloudStorageApiService } from '@/datasources/storage/aws-cloud-storage-api.service';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { faker } from '@faker-js/faker/.';
import { sdkStreamMixin } from '@smithy/util-stream';
import { mockClient } from 'aws-sdk-client-mock';
import { Readable } from 'stream';

const configurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;
const mockConfigurationService = jest.mocked(configurationService);

describe('AwsCloudStorageApiService', () => {
  const s3Mock = mockClient(S3Client);
  const bucketName = faker.string.alphanumeric();
  const basePath = 'base/path';
  mockConfigurationService.getOrThrow.mockImplementation((key) => {
    if (key === 'targetedMessaging.fileStorage.aws.bucketName') {
      return bucketName;
    }
    if (key === 'targetedMessaging.fileStorage.aws.basePath') {
      return basePath;
    }
    throw Error(`Unexpected key: ${key}`);
  });
  const target = new AwsCloudStorageApiService(mockConfigurationService);

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
      mockConfigurationService.getOrThrow.mockImplementation((key) => {
        if (key === 'targetedMessaging.fileStorage.aws.bucketName') {
          return bucketName;
        }
        if (key === 'targetedMessaging.fileStorage.aws.basePath') {
          return 'base//path///'; // Extra slashes should be normalized
        }
        throw Error(`Unexpected key: ${key}`);
      });
      const target = new AwsCloudStorageApiService(mockConfigurationService);
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
});

function buildStream(content: string): Readable {
  const stream = new Readable();
  stream.push(content);
  stream.push(null);
  return stream;
}
