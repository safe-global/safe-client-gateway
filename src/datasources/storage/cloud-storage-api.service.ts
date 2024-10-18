export const ICloudStorageApiService = Symbol('ICloudStorageApiService');

export interface ICloudStorageApiService {
  getFileContent: (key: string) => Promise<string>;
}
