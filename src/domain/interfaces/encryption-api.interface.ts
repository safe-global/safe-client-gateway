export const IEncryptionApi = Symbol('IEncryptionApi');

export interface IEncryptionApi {
  encrypt(data: string): Promise<string>;

  decrypt(data: string): Promise<string>;
}
