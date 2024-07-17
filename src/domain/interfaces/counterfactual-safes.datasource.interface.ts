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

  deleteCounterfactualSafe(account: Account, id: string): Promise<void>;

  deleteCounterfactualSafesForAccount(account: Account): Promise<void>;
}
