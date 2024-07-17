import { CounterfactualSafe } from '@/domain/accounts/counterfactual-safes/entities/counterfactual-safe.entity';
import { CreateCounterfactualSafeDto } from '@/domain/accounts/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import { Account } from '@/domain/accounts/entities/account.entity';

export const ICounterfactualSafesDatasource = Symbol(
  'ICounterfactualSafesDatasource',
);

export interface ICounterfactualSafesDatasource {
  createCounterfactualSafe(
    account: Account,
    createCounterfactualSafeDto: CreateCounterfactualSafeDto,
  ): Promise<CounterfactualSafe>;

  getCounterfactualSafe(id: string): Promise<CounterfactualSafe>;

  getCounterfactualSafesForAccount(
    account: Account,
  ): Promise<CounterfactualSafe[]>;

  // TODO: implement CF Safes deletion
  // (clear cache for both individual and per-address CFs)
}
