import type { IApiManager } from '@/domain/interfaces/api.manager.interface';
import type { IEncryptionApi } from '@/domain/interfaces/encryption-api.interface';

export const IEncryptionApiManager = Symbol('IEncryptionApiManager');

export interface IEncryptionApiManager extends IApiManager<IEncryptionApi> {
  /**
   * Gets an {@link IEncryptionApi} implementation.
   * Each {@link AccountsEncryptionType} is associated with an implementation (i.e.: to an encryption provider).
   *
   * @returns {@link IEncryptionApi} configured for the input chain ID.
   */
  getApi(): Promise<IEncryptionApi>;
}
