import { AwsCloudStorageApiService } from '@/datasources/storage/aws-cloud-storage-api.service';
import type { ILoggingService } from '@/logging/logging.interface';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { faker } from '@faker-js/faker/.';
import { sdkStreamMixin } from '@smithy/util-stream';
import { mockClient } from 'aws-sdk-client-mock';
import { Readable } from 'stream';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn(),
}));

const loggingService = {
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;
const mockLoggingService = jest.mocked(loggingService);

describe('AwsCloudStorageApiService', () => {
  let target: AwsCloudStorageApiService;

  const s3Mock = mockClient(S3Client);
  const accessKeyId = faker.string.alphanumeric();
  const secretAccessKey = faker.string.alphanumeric();
  const bucketName = faker.string.alphanumeric();
  const basePath = 'base/path';

  beforeEach(() => {
    jest.resetAllMocks();

    target = new AwsCloudStorageApiService(
      accessKeyId,
      secretAccessKey,
      bucketName,
      basePath,
      mockLoggingService,
    );
  });

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
      const target = new AwsCloudStorageApiService(
        accessKeyId,
        secretAccessKey,
        bucketName,
        'base//path///',
        mockLoggingService,
      );

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

  describe('createUploadStream', () => {
    const fileName = 'test-file.csv';
    const mockUpload = Upload as jest.MockedClass<typeof Upload>;
    let content: string;
    let body: Readable;
    let ETag: string;

    beforeEach(() => {
      mockUpload.mockClear();

      content = faker.lorem.paragraphs();
      body = buildStream(content);
      ETag = faker.string.alphanumeric();
    });

    it('should create upload stream and return upload promise', async () => {
      const mockDone = jest.fn().mockResolvedValue({ ETag });

      mockUpload.mockImplementation(
        () =>
          ({
            done: mockDone,
            on: jest.fn(),
          }) as unknown as Upload,
      );

      const resultPromise = target.createUploadStream(fileName, body, {
        ContentType: 'text/csv',
      });

      expect(mockUpload).toHaveBeenCalledWith({
        client: expect.any(S3Client),
        params: {
          Bucket: bucketName,
          Key: `${basePath}/${fileName}`,
          Body: body,
          ContentType: 'text/csv',
        },
      });

      const result = await resultPromise;
      expect(mockDone).toHaveBeenCalled();
      expect(result).toEqual({ ETag });
    });

    it('should handle upload errors', async () => {
      const uploadError = new Error('Upload failed');

      mockUpload.mockImplementation(
        () =>
          ({
            done: jest.fn().mockRejectedValue(uploadError),
            on: jest.fn(),
          }) as unknown as Upload,
      );

      await expect(target.createUploadStream(fileName, body)).rejects.toThrow(
        uploadError,
      );

      expect(mockUpload).toHaveBeenCalledWith({
        client: expect.any(S3Client),
        params: {
          Bucket: bucketName,
          Key: `${basePath}/${fileName}`,
          Body: body,
        },
      });
    });

    it('should normalize file paths', async () => {
      const target = new AwsCloudStorageApiService(
        accessKeyId,
        secretAccessKey,
        bucketName,
        'base//path///',
        mockLoggingService,
      );

      mockUpload.mockImplementation(
        () =>
          ({
            done: jest.fn().mockResolvedValue({}),
            on: jest.fn(),
          }) as unknown as Upload,
      );

      await target.createUploadStream(fileName, body);

      expect(mockUpload).toHaveBeenCalledWith({
        client: expect.any(S3Client),
        params: {
          Bucket: bucketName,
          Key: `${basePath}/${fileName}`,
          Body: body,
        },
      });
    });

    it('should track httpUploadProgress event on upload', async () => {
      const mockOn = jest.fn();

      mockUpload.mockImplementation(
        () =>
          ({
            done: jest.fn().mockResolvedValue({ ETag }),
            on: mockOn,
          }) as unknown as Upload,
      );

      await target.createUploadStream(fileName, body, {
        ContentType: 'text/csv',
      });

      expect(mockOn).toHaveBeenCalledWith(
        'httpUploadProgress',
        expect.any(Function),
      );
    });
  });

  describe('getSignedUrl', () => {
    const getSignedUrlMock = getSignedUrl as jest.MockedFunction<
      typeof getSignedUrl
    >;

    it('should generate a signed URL', async () => {
      const fileName = 'test-file.csv';
      const expiresIn = 3600;
      const expectedSignedUrl = 'https://signed-url.example.com';

      getSignedUrlMock.mockResolvedValue(expectedSignedUrl);

      const result = await target.getSignedUrl(fileName, expiresIn);

      expect(result).toBe(expectedSignedUrl);
      expect(getSignedUrlMock).toHaveBeenCalledWith(
        expect.any(S3Client),
        expect.objectContaining({
          input: {
            Bucket: bucketName,
            Key: `base/path/${fileName}`,
          },
        }),
        { expiresIn },
      );
    });

    it('should throw error when generating signed URL fails', async () => {
      const fileName = 'test-file.csv';
      const expiresIn = 3600;

      getSignedUrlMock.mockRejectedValue(new Error('Signed URL error'));

      await expect(target.getSignedUrl(fileName, expiresIn)).rejects.toThrow(
        'Error generating signed URL for S3: Signed URL error',
      );
      expect(getSignedUrlMock).toHaveBeenCalled();
    });
  });
});

function buildStream(content: string): Readable {
  const stream = new Readable();
  stream.push(content);
  stream.push(null);
  return stream;
}
