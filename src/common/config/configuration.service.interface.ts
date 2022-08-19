export const IConfigurationService = Symbol('IConfigurationService');

export interface IConfigurationService {
  get<T>(key: string): T | undefined;
  getOrThrow<T>(key: string): T;
}
