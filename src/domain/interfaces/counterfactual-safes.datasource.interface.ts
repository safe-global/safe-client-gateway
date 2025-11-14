import type { CounterfactualSafe } from '@/modules/accounts/domain/counterfactual-safes/entities/counterfactual-safe.entity';
import type { CreateCounterfactualSafeDto } from '@/modules/accounts/domain/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import type { Account } from '@/modules/accounts/domain/entities/account.entity';
import type { Address } from 'viem';

export const ICounterfactualSafesDatasource = Symbol(
  'ICounterfactualSafesDatasource',
);

export interface ICounterfactualSafesDatasource {
  createCounterfactualSafe(args: {
    account: Account;
    createCounterfactualSafeDto: CreateCounterfactualSafeDto;
  }): Promise<CounterfactualSafe>;

  getCounterfactualSafe(args: {
    address: Address;
    chainId: string;
    predictedAddress: Address;
  }): Promise<CounterfactualSafe>;

  getCounterfactualSafesForAddress(
    address: Address,
  ): Promise<Array<CounterfactualSafe>>;

  deleteCounterfactualSafe(args: {
    account: Account;
    chainId: string;
    predictedAddress: Address;
  }): Promise<void>;

  deleteCounterfactualSafesForAccount(account: Account): Promise<void>;
}
