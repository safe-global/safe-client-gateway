import type { EncryptedBlob } from '@/datasources/accounts/encryption/entities/encrypted-blob.entity';

export const IEncryptionApi = Symbol('IEncryptionApi');

export interface IEncryptionApi {
  encrypt(data: string): Promise<string>;

  decrypt(data: string): Promise<string>;

  encryptBlob<T>(data: T): Promise<EncryptedBlob>;

  decryptBlob<T>(data: EncryptedBlob): Promise<T>;
}
