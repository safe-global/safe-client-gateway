import { SafesByModule } from '@/domain/modules/entities/safes-by-module.entity';

export const IModulesRepository = Symbol('IModulsRepository');

export interface IModulesRepository {
  getSafesByModule(args: {
    chainId: string;
    moduleAddress: string;
  }): Promise<SafesByModule>;

  clearSafesByModule(args: {
    chainId: string;
    moduleAddress: string;
  }): Promise<void>;
}
